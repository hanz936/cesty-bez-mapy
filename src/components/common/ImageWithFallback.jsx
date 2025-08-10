import { useState, useCallback, memo } from 'react';

const ImageWithFallback = memo(({ src, alt, className, fallback, loading = "lazy" }) => {
  const [hasError, setHasError] = useState(false);
  
  const handleError = useCallback(() => {
    setHasError(true);
  }, []);
  
  if (hasError) {
    const fallbackClassName = className || '';
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