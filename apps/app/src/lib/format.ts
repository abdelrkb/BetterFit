/**
 * Mise en forme des nombres en français : la virgule, pas le point.
 *
 * `toFixed` rend toujours un point, quelle que soit la langue du système ;
 * laisser « 79.5 » dans une app française se voit tout de suite.
 */
export function decimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}
