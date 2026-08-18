export function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  );
}
