import { Injectable, inject, signal } from '@angular/core';
import { apiAction } from '@shared/api';
import { RoomApi } from '../api/room-api';
import { RoomSessions } from './room-sessions';
import type { HostKey } from '../api/room-api.types';

/**
 * This page acting as a room's host. Provide it on the host page; everything below that page acts
 * through it, sharing one busy state, so that two host actions cannot overlap.
 */
@Injectable()
export class HostSession {
  private readonly api = inject(RoomApi);
  private readonly sessions = inject(RoomSessions);
  private readonly action = apiAction();

  readonly authorized = signal(false);
  readonly busy = this.action.busy;
  private hostKey: HostKey | null = null;

  /** The proof of being the host. Use only under a view shown while `authorized`. */
  get key(): HostKey {
    if (!this.hostKey) throw new Error('HostSession used before authorization');
    return this.hostKey;
  }

  async authorize(code: string, roomId: string): Promise<void> {
    const token = this.sessions.hostToken(code);
    if (!token) return;
    const key = { roomId, token };
    const valid = await this.api.isHost(key).catch(() => false);
    if (valid) this.hostKey = key;
    this.authorized.set(valid);
  }

  act(work: (api: RoomApi, key: HostKey) => Promise<unknown>): Promise<boolean> {
    return this.action.run(() => work(this.api, this.key));
  }
}
