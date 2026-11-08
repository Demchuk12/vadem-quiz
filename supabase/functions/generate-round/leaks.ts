// Does a question give its answer away? Models often write the answer into the question in
// another script or form: "named after the Super Bowl" for "Super Bowl". Words are compared by
// the start of their stems, after both scripts are spelled one way.

const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'e',
  ё: 'e',
  э: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'i',
  й: 'i',
  ы: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'g',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ъ: '',
  ю: 'iu',
  я: 'ia',
};

/** One spelling for both scripts, close enough to match a name across them. */
export function spell(word: string): string {
  const latin = [...word.toLowerCase()].map((c) => CYRILLIC[c] ?? c).join('');
  return latin
    .replace(/ph/g, 'f')
    .replace(/[hq]/g, (c) => (c === 'h' ? 'g' : 'k'))
    .replace(/c/g, 'k')
    .replace(/w/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/[^a-z0-9]/g, '')
    .replace(/([a-z])\1+/g, '$1');
}

const words = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** How much of a word's start two words must share to count as the same word. */
const STEM = 5;

/**
 * True when the question holds the answer's most telling word, matched by the start of its stem:
 * the longest word of at least four characters, the last of equals, since a name tends to follow
 * a common noun ("річка Дніпро").
 */
export function leaksAnswer(question: string, answer: string): boolean {
  const key = words(answer)
    .map(spell)
    .filter((word) => word.length >= 4)
    .reduce<string | undefined>(
      (best, word) => (!best || word.length >= best.length ? word : best),
      undefined,
    );
  if (!key) return false;
  const stem = key.slice(0, STEM);
  return words(question)
    .map(spell)
    .some((word) => word.length >= Math.min(stem.length, 4) && word.startsWith(stem));
}
