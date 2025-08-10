import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';

const NotFound = () => {
  return (
    <Layout>
      <div className="flex items-center justify-center px-4 py-16 min-h-96">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🗺️</span>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Stránka nenalezena
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Vypadá to, že ses dostal na cestu, která neexistuje. Ale neboj, pomohu ti najít správnou!
            </p>
            
            <div className="space-y-4">
              <Link 
                to="/" 
                className="block bg-green-800 hover:bg-green-900 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 focus:outline-none"
              >
                Zpět na hlavní stránku
              </Link>
              
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link 
                  to="/inspirace" 
                  className="text-green-800 hover:text-green-900 font-medium transition-colors duration-200 supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 focus:outline-none rounded"
                >
                  Inspirace na cesty
                </Link>
                <span className="hidden sm:inline text-gray-400">•</span>
                <Link 
                  to="/cestovni-pruvodci" 
                  className="text-green-800 hover:text-green-900 font-medium transition-colors duration-200 supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 focus:outline-none rounded"
                >
                  Cestovní průvodci
                </Link>
                <span className="hidden sm:inline text-gray-400">•</span>
                <Link 
                  to="/muj-pribeh" 
                  className="text-green-800 hover:text-green-900 font-medium transition-colors duration-200 supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 focus:outline-none rounded"
                >
                  Můj příběh
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

NotFound.displayName = 'NotFound';

export default NotFound;