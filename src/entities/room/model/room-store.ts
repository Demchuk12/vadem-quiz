import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { SUPABASE } from '@shared/api';
import {
  boardColumns,
  boardRows,
  newerRoom,
  normalizeRoomCode,
  rankPlayers,
  upsertById,
} from '../lib/game-logic';
import { VerdictTracker } from '../lib/verdicts';
import type { Player, Room, RoomCell, RoomLoadStatus, Verdict } from './room';

/** How long the screens show a verdict; the animations in ui/verdict fit inside it. */
const VERDICT_MS = 2200;

interface PresenceMeta {
  playerId: string;
}

/**
 * Live state of one room for one page: a realtime subscription plus a full reload whenever the
 * subscription (re)connects, because events sent while disconnected are not replayed.
 * Provide it on the page component.
 */
@Injectable()
export class RoomStore {
  private readonly supabase = inject(SUPABASE);
  private readonly document = inject(DOCUMENT);

  readonly status = signal<RoomLoadStatus>('loading');
  /** False while the realtime connection is down; what is on screen may be stale. */
  readonly connected = signal(false);
  readonly room = signal<Room | null>(null);
  readonly players = signal<Player[]>([]);
  readonly cells = signal<RoomCell[]>([]);
  readonly onlinePlayerIds = signal<ReadonlySet<string>>(new Set());

  readonly ranked = computed(() => rankPlayers(this.players()));
  readonly columns = computed(() => boardColumns(this.cells(), this.room()?.round ?? 1));
  readonly rows = computed(() => boardRows(this.columns()));
  readonly winner = computed(() => {
    const winnerId = this.room()?.buzz_winner_player_id;
    return winnerId ? (this.players().find((p) => p.id === winnerId) ?? null) : null;
  });
  /** The host's latest call on an answer, while the screens show it; null in between. */
  readonly verdict = signal<Verdict | null>(null);
  readonly currentCell = computed(() => {
    const cellId = this.room()?.current_cell_id;
    return cellId ? (this.cells().find((c) => c.id === cellId) ?? null) : null;
  });

  private channel: RealtimeChannel | null = null;
  private destroyed = false;
  private eventCount = 0;

  constructor() {
    const tracker = new VerdictTracker();
    let verdictTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const verdict = tracker.observe(this.room(), this.players());
      if (!verdict) return;
      untracked(() => this.verdict.set(verdict));
      clearTimeout(verdictTimer);
      verdictTimer = setTimeout(() => this.verdict.set(null), VERDICT_MS);
    });

    const reload = () => {
      if (this.document.visibilityState === 'visible') void this.reload();
    };
    const view = this.document.defaultView;
    // A phone that slept may have missed events with the socket still looking alive.
    this.document.addEventListener('visibilitychange', reload);
    view?.addEventListener('online', reload);

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(verdictTimer);
      this.document.removeEventListener('visibilitychange', reload);
      view?.removeEventListener('online', reload);
      if (this.channel) void this.supabase.removeChannel(this.channel);
    });
  }

  /** `presencePlayerId` marks this page as that player being online. */
  async connect(code: string, presencePlayerId?: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('code', normalizeRoomCode(code))
      .maybeSingle<Room>();

    if (this.destroyed) return;
    if (error) {
      this.status.set('error');
      return;
    }
    if (!data) {
      this.status.set('not_found');
      return;
    }
    this.room.set(data);
    this.subscribe(data.id, presencePlayerId);
  }

  private subscribe(roomId: string, presencePlayerId?: string): void {
    const channel = this.supabase.channel(`room:${roomId}`, {
      config: { presence: { key: presencePlayerId ?? '' } },
    });

    channel
      .on<Room>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        ({ new: room }) => {
          this.eventCount += 1;
          this.room.update((current) => newerRoom(current, room as Room));
        },
      )
      .on<Player>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        ({ new: player }) => {
          this.eventCount += 1;
          if ('id' in player) this.players.update((all) => upsertById(all, player as Player));
        },
      )
      .on<RoomCell>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_cells', filter: `room_id=eq.${roomId}` },
        ({ new: cell }) => {
          this.eventCount += 1;
          this.cells.update((all) => upsertById(all, cell as RoomCell));
        },
      )
      // SUBSCRIBED comes before database changes start flowing. This later message marks the real
      // start, so anything that changed in between is picked up by loading once more.
      .on('system', {}, (message: { extension?: string; status?: string }) => {
        if (message.extension === 'postgres_changes' && message.status === 'ok') {
          void this.reload();
        }
      })
      .on('presence', { event: 'sync' }, () => {
        this.onlinePlayerIds.set(onlineIds(channel.presenceState<PresenceMeta>()));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.connected.set(true);
          void this.reload();
          if (presencePlayerId) void channel.track({ playerId: presencePlayerId });
        } else {
          this.connected.set(false);
        }
      });

    this.channel = channel;
  }

  private async reload(): Promise<void> {
    const roomId = this.room()?.id;
    if (!roomId) return;

    const eventsBefore = this.eventCount;
    const [room, players, cells] = await Promise.all([
      this.supabase.from('rooms').select('*').eq('id', roomId).single<Room>(),
      this.supabase.from('players').select('*').eq('room_id', roomId),
      this.supabase.from('room_cells').select('*').eq('room_id', roomId),
    ]);
    if (this.destroyed) return;
    if (room.error || players.error || cells.error) {
      // Keep what is on screen after a successful load; a first load has nothing to show.
      if (this.status() === 'loading') this.status.set('error');
      return;
    }
    // An event during the load may be newer than this response: load again instead of losing it.
    if (this.eventCount !== eventsBefore) return this.reload();

    this.room.update((current) => newerRoom(current, room.data));
    this.players.set(players.data as Player[]);
    this.cells.set(cells.data as RoomCell[]);
    this.status.set('ready');
  }
}

function onlineIds(state: RealtimePresenceState<PresenceMeta>): ReadonlySet<string> {
  const ids = Object.values(state)
    .flat()
    .map((meta) => meta.playerId)
    .filter(Boolean);
  return new Set(ids);
}
