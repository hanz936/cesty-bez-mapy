import { describe, it, expect } from 'vitest';
import { copyrightYears, FIRST_PUBLICATION_YEAR } from './copyright';

describe('copyrightYears', () => {
  it('v roce vydání ukazuje jediný rok, ne rozsah', () => {
    expect(copyrightYears(2026, 2026)).toBe('2026');
  });

  it('později ukazuje rozsah od vydání po dnešek', () => {
    expect(copyrightYears(2031, 2026)).toBe('2026–2031');
  });

  it('rozbité hodiny nevyrobí rozsah pozpátku', () => {
    // Kdyby se místo `>` porovnávalo na nerovnost, vzniklo by „2026–2024".
    expect(copyrightYears(2024, 2026)).toBe('2026');
  });

  it('bez druhého argumentu bere rok vydání webu', () => {
    expect(copyrightYears(FIRST_PUBLICATION_YEAR)).toBe(String(FIRST_PUBLICATION_YEAR));
    expect(copyrightYears(FIRST_PUBLICATION_YEAR + 1)).toBe(
      `${FIRST_PUBLICATION_YEAR}–${FIRST_PUBLICATION_YEAR + 1}`,
    );
  });
});
