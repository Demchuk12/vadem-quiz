import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { localSupabase, QUIZ_JSON } from './helpers';

const CONTENDERS = 30;

test('simultaneous presses: exactly one winner, and it is the winner the room records', async () => {
  const { url, anonKey } = localSupabase();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const rpc = async <T>(fn: string, args: object): Promise<T> => {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  };

  const [quiz] = await rpc<{ quiz_id: string; owner_token: string }[]>('create_quiz', {
    p_title: 'Race',
  });
  await rpc('save_quiz', {
    p_quiz_id: quiz!.quiz_id,
    p_token: quiz!.owner_token,
    p_document: JSON.parse(QUIZ_JSON),
  });
  const [room] = await rpc<{ room_id: string; room_code: string; host_token: string }[]>(
    'create_room',
    { p_quiz_id: quiz!.quiz_id, p_quiz_token: quiz!.owner_token },
  );
  const host = { p_room_id: room!.room_id, p_token: room!.host_token };

  // The room's player limit is 32.
  const players = await Promise.all(
    Array.from({ length: CONTENDERS }, async (_, i) => {
      const [player] = await rpc<{ player_id: string; player_token: string }[]>('join_room', {
        p_code: room!.room_code,
        p_nickname: `P${i}`,
      });
      return player!;
    }),
  );

  await rpc('start_game', host);
  const { data: cells } = await client
    .from('room_cells')
    .select('id')
    .eq('room_id', room!.room_id)
    .eq('round', 1);
  await rpc('open_question', { ...host, p_cell_id: cells![0]!.id });
  await rpc('open_buzz', host);

  const results = await Promise.all(
    players.map((player) =>
      rpc<boolean>('buzz', {
        p_room_id: room!.room_id,
        p_player_id: player.player_id,
        p_token: player.player_token,
      }),
    ),
  );

  expect(results.filter(Boolean)).toHaveLength(1);
  const winner = players[results.indexOf(true)]!;
  const { data: state } = await client
    .from('rooms')
    .select('state, buzz_winner_player_id')
    .eq('id', room!.room_id)
    .single();
  expect(state).toEqual({ state: 'buzzed', buzz_winner_player_id: winner.player_id });
});

test('the anon key cannot reach private data or change the game directly', async () => {
  const { url, anonKey } = localSupabase();
  const client = createClient(url, anonKey, { auth: { persistSession: false } });

  // PostgREST does not expose the schema at all.
  const { error: hidden } = await client.schema('private').from('questions').select('*');
  expect(hidden).not.toBeNull();

  const { data: rows, error } = await client
    .from('rooms')
    .update({ state: 'finished' })
    .neq('code', '')
    .select();
  expect(rows ?? []).toEqual([]);
  expect(error?.code).toBe('42501');

  const listing = await client.storage.from('quiz-media').list();
  expect(listing.data ?? []).toEqual([]);
});
