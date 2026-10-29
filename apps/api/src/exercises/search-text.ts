/**
 * Texte sur lequel porte la recherche.
 *
 * On y met le nom français, le nom anglais (beaucoup de coachs cherchent
 * « bench press ») et les muscles. Les accents sont retirés pour que
 * « élévations » se trouve en tapant « elevations ».
 */
export function buildSearchText(input: {
  name: string;
  nameEn?: string | null;
  muscles?: string[];
}): string {
  return [input.name, input.nameEn ?? '', ...(input.muscles ?? [])]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
