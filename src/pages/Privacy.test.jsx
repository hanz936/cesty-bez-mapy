// src/pages/Privacy.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyContent } from './Privacy';

describe('Privacy page content', () => {
  it('renders the heading and the cookieless analytics statement', () => {
    render(<MemoryRouter><PrivacyContent /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/ochran[aě] osobních údajů/i);
    expect(screen.getByText(/cookieless/i)).toBeInTheDocument();
  });

  it('lists key storage entries', () => {
    render(<MemoryRouter><PrivacyContent /></MemoryRouter>);
    expect(screen.getByText(/cbm_cart/)).toBeInTheDocument();
    expect(screen.getByText(/Umami/)).toBeInTheDocument();
  });
});
