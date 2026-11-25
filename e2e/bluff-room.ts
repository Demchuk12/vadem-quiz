import { localSupabase } from './helpers';

const UKRAINIAN_FACTS = Array.from({ length: 5 }, (_, i) =>
  i === 0
    ? { text: 'У Швеції є готель, збудований з…', truth: 'льоду', decoy: 'соломи' }
    : { text: `Факт ${i + 1}…`, truth: `правда ${i + 1}`, decoy: `пастка ${i + 1}` },
);

/** Calls a database function as any client would, with the public key. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { url, anonKey } = localSupabase();
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error(`${fn}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** A "Варіанти" room; without facts of its own, five with the first "готель з… льоду". */
export async function bluffRoom(
  title = 'Тест варіантів',
  facts: { text: string; truth: string; decoy: string }[] = UKRAINIAN_FACTS,
): Promise<{ roomId: string; code: string; hostToken: string }> {
  const [quiz] = await rpc<{ quiz_id: string; owner_token: string }[]>('create_quiz', {
    p_title: title,
  });
  await rpc('save_quiz', {
    p_quiz_id: quiz!.quiz_id,
    p_token: quiz!.owner_token,
    p_document: { title, mode: 'bluff', facts },
  });
  const [room] = await rpc<{ room_id: string; room_code: string; host_token: string }[]>(
    'create_room',
    { p_quiz_id: quiz!.quiz_id, p_quiz_token: quiz!.owner_token },
  );
  return { roomId: room!.room_id, code: room!.room_code, hostToken: room!.host_token };
}
