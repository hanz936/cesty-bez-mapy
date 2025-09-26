import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import ReviewsSection from '../components/reviews/ReviewsSection';
import { BASE_PATH, ROUTES } from '../constants';

const Reviews = memo(() => {
  const navigate = useNavigate();

  const handleTravelGuidesClick = () => {
    navigate(ROUTES.TRAVEL_GUIDES);
  };

  const handleCustomItineraryClick = () => {
    navigate(ROUTES.CUSTOM_ITINERARY_DETAIL);
  };

  return (
    <Layout>
      {/* Hero Section */}
      <PageHero
        backgroundImage={`${BASE_PATH}/images/blog-hero-cestovni-pruvodci.png`}
        title="Recenze cestovatelů"
        subtitle="Přečti si, co říkají ti, kteří už s námi cestovali"
        overlayOpacity={0.6}
        ariaLabel="Hero sekce recenzí cestovatelů"
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-5" role="main">


        {/* Reviews Section */}
        <ReviewsSection
          autoScroll={true}
          className="pb-16"
        />

        {/* CTA Section - More elegant */}
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl p-12 sm:p-16 shadow-lg border border-gray-100">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                Chceš se přidat k mým spokojeným cestovatelům?
              </h2>
              <p className="text-gray-600 mb-10 leading-relaxed text-lg">
                Začni s jedním z mých itinerářů nebo si nech připravit cestu přímo na míru.
                Každý průvodce obsahuje detailní plán, tipy od místních a podporu během celé cesty.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={handleTravelGuidesClick}
                  className="bg-green-800 hover:bg-green-900 text-white px-10 py-4 rounded-2xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Prohlédnout průvodce
                </button>
                <button
                  onClick={handleCustomItineraryClick}
                  className="bg-white hover:bg-gray-50 text-green-800 px-10 py-4 rounded-2xl font-medium border-2 border-green-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Itinerář na míru
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>
    </Layout>
  );
});

Reviews.displayName = 'Reviews';

export default Reviews;