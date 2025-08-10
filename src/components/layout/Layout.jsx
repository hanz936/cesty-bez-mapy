import React from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import { Button } from '../ui';
import logger from '../../utils/logger';

class LayoutErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Layout Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Něco se pokazilo
            </h1>
            <p className="text-gray-600 mb-6">
              Stránka se nedá načíst. Zkuste prosím obnovit stránku.
            </p>
            <Button
              onClick={() => window.location.reload()}
              variant="primary"
              size="md"
            >
              Obnovit stránku
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

LayoutErrorBoundary.displayName = 'LayoutErrorBoundary';

const Layout = ({ children, className = '' }) => {
  return (
    <LayoutErrorBoundary>
      <div className={`min-h-screen bg-white ${className}`.trim()}>
        {/* Skip to main content for keyboard users */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-green-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Přejít na hlavní obsah
        </a>
        <Navigation />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </div>
    </LayoutErrorBoundary>
  );
};

Layout.displayName = 'Layout';

export default Layout;