import './App.css'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MyStory from './pages/MyStory';
import Collaboration from './pages/Collaboration';
import PlanYourDreamTrip from './pages/PlanYourDreamTrip';
import logger from './utils/logger';

// Error boundary for the entire application
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for monitoring in production
    logger.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Něco se pokazilo
              </h1>
              <p className="text-gray-600 mb-6">
                Omlouváme se, ale aplikace narazila na neočekávanou chybu. Zkuste prosím obnovit stránku.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Obnovit stránku
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <Router>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/MyStory" element={<MyStory />} />
            <Route path="/muj-pribeh" element={<MyStory />} />
            <Route path="/naplanuj-si-cestu-snu" element={<PlanYourDreamTrip />} />
            <Route path="/plan-your-dream-trip" element={<PlanYourDreamTrip />} />
            <Route path="/cestovni-pruvodci" element={<Home />} />
            <Route path="/inspirace" element={<Home />} />
            <Route path="/spoluprace" element={<Collaboration />} />
          </Routes>
        </div>
      </Router>
    </AppErrorBoundary>
  )
}

export default App
