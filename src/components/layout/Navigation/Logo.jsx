import React from 'react';
import { Link } from 'react-router-dom';
import { BASE_PATH } from '../../../constants';
import ImageWithFallback from '../../common/ImageWithFallback';

const Logo = React.memo(() => {
  return (
    <Link 
      to="/" 
      className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 text-inherit h-full focus:outline-none rounded supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
      aria-label="Cesty bez mapy - domovská stránka"
    >
      <ImageWithFallback 
        src={`${BASE_PATH}/images/logo.png`}
        alt="Cesty bez mapy logo" 
        className="h-16 xl:h-20 w-auto"
        loading="eager"
        fallback={<div className="h-16 xl:h-20 w-16 xl:w-20 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">Logo</div>}
      />
      <span className="font-bold text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-black leading-none">
        Cesty (bez) mapy
      </span>
    </Link>
  );
});

Logo.displayName = 'Logo';

export default Logo;