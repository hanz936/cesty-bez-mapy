import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Lightbox from './Lightbox';

const IMAGES = [
  { src: '/a.png', alt: 'Obrázek A' },
  { src: '/b.png', alt: 'Obrázek B' },
];

describe('Lightbox', () => {
  it('nevykreslí nic když isOpen=false', () => {
    const { container } = render(
      <Lightbox images={IMAGES} isOpen={false} initialIndex={0} onClose={() => {}} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('vykreslí dialog s aria-modal a obrázky když isOpen=true', () => {
    render(<Lightbox images={IMAGES} isOpen initialIndex={0} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByAltText('Obrázek A')).toBeInTheDocument();
  });

  it('Escape volá onClose', () => {
    const onClose = vi.fn();
    render(<Lightbox images={IMAGES} isOpen initialIndex={0} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
// Pozn.: scroll-lock je delegovaný na react-remove-scroll (testováno upstream); injektuje
// <style> pravidlo (ne inline document.body.style.overflow) → v jsdom neasertovat na body.style.
