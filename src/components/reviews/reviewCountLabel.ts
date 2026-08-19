/**
 * České skloňování slova „recenze" podle počtu. Vrací holé slovo bez čísla,
 * aby si volající mohl číslo naformátovat po svém.
 */
export function reviewCountLabel(count: number): string {
  return count >= 1 && count <= 4 ? 'recenze' : 'recenzí';
}
