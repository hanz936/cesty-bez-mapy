import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BillingForm } from './BillingForm.jsx';

vi.mock('../../utils/ares.js', () => ({
  lookupIco: vi.fn(),
}));
import { lookupIco } from '../../utils/ares.js';

describe('BillingForm', () => {
  beforeEach(() => { (lookupIco as unknown as Mock).mockReset(); });

  it('renders only the checkbox when not enabled', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op callback; test does not exercise onChange here; byte-identical
    render(<BillingForm value={{ is_company: false }} onChange={() => {}} />);
    expect(screen.queryByLabelText(/IČO/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Koupit na firmu/i)).toBeInTheDocument();
  });

  it('shows fields after checking the box', () => {
    const onChange = vi.fn();
    render(<BillingForm value={{ is_company: false }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Koupit na firmu/i));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ is_company: true }));
  });

  it('auto-fills from ARES when IČO is valid', async () => {
    (lookupIco as unknown as Mock).mockResolvedValueOnce({
      name: 'Acme s.r.o.', dic: 'CZ27082440',
      street: 'Hlavní 1', city: 'Praha', zip: '11000',
    });
    const onChange = vi.fn();
    render(<BillingForm value={{ is_company: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/IČO/i), { target: { value: '27082440' } });
    fireEvent.blur(screen.getByLabelText(/IČO/i));
    await waitFor(() => expect(lookupIco).toHaveBeenCalledWith('27082440'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      company_name: 'Acme s.r.o.',
      billing_city: 'Praha',
    })));
  });

  it('does not call ARES for invalid IČO', async () => {
    const onChange = vi.fn();
    render(<BillingForm value={{ is_company: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/IČO/i), { target: { value: '12345678' } });
    fireEvent.blur(screen.getByLabelText(/IČO/i));
    await new Promise(r => setTimeout(r, 50));
    expect(lookupIco).not.toHaveBeenCalled();
  });

  it('shows error message when IČO checksum invalid', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op callback; test does not exercise onChange here; byte-identical
    render(<BillingForm value={{ is_company: true, company_ico: '12345678' }} onChange={() => {}} />);
    fireEvent.blur(screen.getByLabelText(/IČO/i));
    expect(screen.getByText(/neplatné IČO/i)).toBeInTheDocument();
  });
});
