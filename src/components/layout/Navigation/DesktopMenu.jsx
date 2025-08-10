import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, BASE_PATH } from '../../../constants';
import ImageWithFallback from '../../common/ImageWithFallback';

const DesktopMenu = () => {
  const location = useLocation();

  return (
    <>
      {/* Navigation Links */}
      <div className="hidden xl:flex flex-1 justify-center items-center h-full">
        <ul className="list-none flex flex-wrap justify-center items-center h-full">
          {NAV_ITEMS.map((item, index) => (
            <li key={item.href} className="relative px-5">
              <Link 
                to={item.href}
                className="text-black font-bold text-lg whitespace-nowrap hover:underline focus:outline-none rounded transition-colors duration-200 motion-reduce:transition-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
                aria-current={location.pathname === item.href ? "page" : undefined}
              >
                {item.text}
              </Link>
              {index < NAV_ITEMS.length - 1 && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 h-5 w-px bg-gray-300" aria-hidden="true"></div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Instagram Link */}
      <div className="hidden xl:flex items-center gap-2.5 h-full">
        <a 
          href="https://www.instagram.com/cestybezmapy" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Sleduj mě na Instagramu @cestybezmapy"
          className="focus:outline-none rounded touch-manipulation supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
        >
          <ImageWithFallback 
            src={`${BASE_PATH}/images/instagram.svg`}
            alt="Instagram" 
            className="w-7 h-7 grayscale hover:grayscale-0 transition-all duration-300 motion-reduce:transition-none"
            loading="eager"
            fallback={<div className="w-7 h-7 bg-gray-400 rounded flex items-center justify-center text-white text-xs">IG</div>}
          />
        </a>
      </div>
    </>
  );
};

DesktopMenu.displayName = 'DesktopMenu';

export default DesktopMenu;