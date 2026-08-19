export type PaginationItem = number | 'gap';

/** Do téhle délky se vypíšou všechny strany; nad ní se prostředek zkrátí. */
const FULL_LIST_LIMIT = 7;

/**
 * Které strany se ve stránkování vypíšou. Vždy první, poslední, aktuální a její
 * sousedi; mezery mezi nimi nahradí `'gap'`. Bez zkrácení by produkt s 300
 * recenzemi vyrobil 30 odkazů v jedné navigaci.
 */
export function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= FULL_LIST_LIMIT) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const keep = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...keep].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) items.push('gap');
    items.push(page);
    previous = page;
  }
  return items;
}
