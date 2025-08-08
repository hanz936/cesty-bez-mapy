import React from 'react';
import Navigation from '../components/Navigation';
import Hero from '../components/Hero';
import logger from '../utils/logger';

class HomeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Home Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Něco se pokazilo
            </h1>
            <p className="text-gray-600 mb-6">
              Stránka se nedá načíst. Zkuste prosím obnovit stránku.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Obnovit stránku
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

HomeErrorBoundary.displayName = 'HomeErrorBoundary';

const Home = () => {
  return (
    <main className="min-h-screen">
      <Navigation />
      <Hero />
    </main>
  );
};

Home.displayName = 'Home';

const HomeWithErrorBoundary = () => (
  <HomeErrorBoundary>
    <Home />
  </HomeErrorBoundary>
);

HomeWithErrorBoundary.displayName = 'HomeWithErrorBoundary';

export default HomeWithErrorBoundary;