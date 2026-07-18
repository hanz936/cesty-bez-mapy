// src/components/quiz/SealBadge.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SealBadge from './SealBadge';

describe('SealBadge', () => {
  it('check varianta vykreslí fajfku a je aria-hidden', () => {
    const { container } = render(<SealBadge variant="check" size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('path[stroke-linecap="round"]')).toBeTruthy();
  });

  it('score varianta ukáže úroveň velkými písmeny a procento', () => {
    const { container } = render(<SealBadge variant="score" tier="Skvělá shoda" score={87} />);
    expect(container.textContent).toContain('SKVĚLÁ SHODA');
    expect(container.textContent).toContain('87');
  });

  it('lg score má vnitřní kroužek, sm nemá (čitelnost malé pečeti)', () => {
    const lg = render(<SealBadge variant="score" tier="Dobrá shoda" score={74} size="lg" />);
    const sm = render(<SealBadge variant="score" tier="Dobrá shoda" score={74} size="sm" />);
    expect(lg.container.querySelectorAll('circle')).toHaveLength(3);
    expect(sm.container.querySelectorAll('circle')).toHaveLength(2);
  });
});
