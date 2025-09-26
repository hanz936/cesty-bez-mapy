import React, { memo } from 'react';

const ReviewCard = memo(({
  name,
  rating,
  text,
  location,
  source,
  date,
  className = ''
}) => {
  // Generate stars based on rating - more elegant, smaller
  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      const isFull = starNumber <= Math.floor(rating);
      const isHalf = starNumber === Math.ceil(rating) && rating % 1 !== 0;

      return (
        <div key={starNumber} className="relative">
          {/* Background star */}
          <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          {/* Foreground star */}
          {(isFull || isHalf) && (
            <svg
              className="w-3.5 h-3.5 text-green-800 absolute top-0 left-0"
              fill="currentColor"
              viewBox="0 0 24 24"
              style={{ clipPath: isHalf ? 'inset(0 50% 0 0)' : 'none' }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          )}
        </div>
      );
    });
  };

  // Subtle source indicator
  const getSourceText = (source) => {
    switch (source) {
      case 'google':
        return 'Google';
      case 'instagram':
        return 'Instagram';
      case 'itinerary':
        return 'Itinerář';
      default:
        return 'Recenze';
    }
  };

  return (
    <div className={`bg-white rounded-3xl p-8 lg:p-10 transition-all duration-500 border border-gray-100 group relative overflow-hidden backdrop-blur-sm h-[400px] flex flex-col ${className}`.trim()}>

      {/* Elegant gradient border */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-50/30 via-transparent to-gray-50/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-800 to-transparent opacity-60"></div>

      {/* Floating quote icon */}
      <div className="absolute -top-2 -right-2 w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-500">
        <div className="text-green-800 opacity-20 group-hover:opacity-30 transition-opacity duration-300">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
          </svg>
        </div>
      </div>

      {/* Header with subtle rating */}
      <div className="flex items-center justify-start mb-6 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {renderStars(rating)}
          <span className="ml-2 text-xs font-medium text-gray-500 tracking-wide">{rating}</span>
        </div>
      </div>

      {/* Review text - fixed height with scroll */}
      <div className="mb-8 flex-grow overflow-hidden h-32">
        <p className="text-gray-700 leading-relaxed text-base italic font-light tracking-wide line-clamp-6">
          "{text}"
        </p>
      </div>

      {/* Footer with enhanced user info - always at bottom */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100 flex-shrink-0 mt-auto">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300">
            <span className="text-green-800 font-semibold text-sm">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-green-800 transition-colors duration-300">{name}</p>
            <p className="text-xs text-gray-500">{location}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400 font-medium">{date}</span>
        </div>
      </div>
    </div>
  );
});

ReviewCard.displayName = 'ReviewCard';

export default ReviewCard;