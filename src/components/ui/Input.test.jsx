import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Input from './Input';

describe('Input error wiring', () => {
  it('bez chyby: žádné aria-invalid', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('s chybou: aria-invalid + aria-describedby napojené na role=alert', () => {
    render(<Input label="Email" error="Neplatný email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const desc = input.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', desc);
    expect(alert).toHaveTextContent('Neplatný email');
  });
});
