import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Dropdown from './Dropdown';

const options = [{ value: 'a', label: 'Áčko' }, { value: 'b', label: 'Béčko' }];

describe('Dropdown (APG combobox)', () => {
  it('trigger má role=combobox a aria-haspopup=listbox', () => {
    render(<Dropdown label="Test" options={options} value="" onChange={() => {}} />);
    const combo = screen.getByRole('combobox');
    expect(combo).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });

  it('ArrowDown otevře listbox a Enter vybere', () => {
    const onChange = vi.fn();
    render(<Dropdown label="Test" options={options} value="" onChange={onChange} />);
    const combo = screen.getByRole('combobox');
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target.value).toBe('a');
  });

  it('options mají role=option', () => {
    render(<Dropdown label="Test" options={options} value="" onChange={() => {}} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
