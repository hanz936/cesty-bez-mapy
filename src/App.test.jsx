import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the app with navigation', () => {
    render(<App />)
    
    // Test že se aplikace vyrendovala - navigace by měla být přítomna
    const navigation = screen.getByRole('navigation')
    expect(navigation).toBeInTheDocument()
  })

  it('renders home route by default', () => {
    render(<App />)
    
    // Test že je vyrendrovaná domovská stránka s hero sekcí
    const heroSection = screen.getByText(/sni/i)
    expect(heroSection).toBeInTheDocument()
  })

  it('applies correct CSS classes to root container', () => {
    render(<App />)
    
    const rootDiv = screen.getByRole('navigation').closest('.min-h-screen')
    expect(rootDiv).toHaveClass('min-h-screen')
  })
})