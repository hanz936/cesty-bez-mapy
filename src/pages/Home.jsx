import React from 'react';
import { Helmet } from 'react-helmet-async';
import Navigation from '../components/Navigation';
import Hero from '../components/Hero';

class HomeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Home Error:', error, errorInfo);
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
      <Helmet>
        <title>Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty</title>
        <meta 
          name="description" 
          content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem." 
        />
        <meta property="og:title" content="Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty" />
        <meta 
          property="og:description" 
          content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem." 
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/images/logo.png" />
        <link rel="canonical" href="https://cestybezmapy.cz/" />
      </Helmet>
      
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