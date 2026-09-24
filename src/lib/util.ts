export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const plural = (n: number, singular: string, pluralForma = `${singular}s`) => (n === 1 ? singular : pluralForma);
