import Navigation from '../components/layout/Navigation';
import Hero from '../components/common/Hero';

const Home = () => {
  return (
    <div className="min-h-screen bg-white" data-prerender-ready="true">
      <Navigation />
      <Hero />
    </div>
  );
};

Home.displayName = 'Home';

export default Home;