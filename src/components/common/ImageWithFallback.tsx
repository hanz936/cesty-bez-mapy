import { useState, useCallback, memo } from 'react';
import type { ReactNode, ComponentProps } from 'react';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  loading?: ComponentProps<'img'>['loading'];
}

const ImageWithFallback = memo(({ src, alt, className, fallback, loading = "lazy" }: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);
  
  const handleError = useCallback(() => {
    setHasError(true);
  }, []);
  
  if (hasError) {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: keep pre-existing JS behavior byte-identical (empty string falls through)
    const fallbackClassName = className || '';
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: falsy ReactNode (false/null/'') must fall through to the default placeholder (?? would render it)
    return fallback || (
      <div className={`${fallbackClassName} min-h-7 min-w-7 bg-gray-200 flex items-center justify-center text-xs text-gray-500`}>
        ?
      </div>
    );
  }
  
  return (
    <img 
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      loading={loading}
    />
  );
});

ImageWithFallback.displayName = 'ImageWithFallback';

export default ImageWithFallback;