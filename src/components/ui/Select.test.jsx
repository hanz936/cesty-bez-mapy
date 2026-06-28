import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Select from './Select';

const options = [{ value: 'a', label: 'Áčko' }, { value: 'b', label: 'Béčko' }];

describe('Select (APG combobox + error)', () => {
  it('trigger má role=combobox', () => {
    render(<Select label="Test" options={options} value="" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('Enter po ArrowDown vybere a volá onChange', () => {
    const onChange = vi.fn();
    render(<Select label="Test" options={options} value="" onChange={onChange} />);
    const combo = screen.getByRole('combobox');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(onChange.mock.calls[0][0].target.value).toBe('a');
  });

  it('error nastaví aria-invalid a aria-describedby', () => {
    render(<Select label="Test" options={options} value="" onChange={() => {}} error="Povinné" />);
    const combo = screen.getByRole('combobox');
    expect(combo).toHaveAttribute('aria-invalid', 'true');
    const desc = combo.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveAttribute('id', desc);
  });
});
