import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Button } from './components/ui';
import { ROUTES } from './constants';
import Home from './pages/Home';
import MyStory from './pages/MyStory';
import Collaboration from './pages/Collaboration';
import PlanYourDreamTrip from './pages/PlanYourDreamTrip';
import TravelInspiration from './pages/TravelInspiration';
import TravelGuides from './pages/TravelGuides';
import NotFound from './pages/NotFound';
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
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
                size="md"
              >
                Obnovit stránku
              </Button>
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
        <Routes>
          <Route path={ROUTES.HOME} element={<Home />} />
          <Route path={ROUTES.MY_STORY} element={<MyStory />} />
          <Route path={ROUTES.PLAN_YOUR_DREAM_TRIP} element={<PlanYourDreamTrip />} />
          <Route path={ROUTES.TRAVEL_GUIDES} element={<TravelGuides />} />
          <Route path={ROUTES.INSPIRATION} element={<TravelInspiration />} />
          <Route path={ROUTES.COLLABORATION} element={<Collaboration />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AppErrorBoundary>
  )
}

export default App
