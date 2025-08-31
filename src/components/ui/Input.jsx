import { forwardRef } from 'react';

const Input = forwardRef(({ 
  label, 
  error, 
  required = false, 
  className = "", 
  id,
  ...props 
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="space-y-2">
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-black"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input-base w-full px-4 py-3 text-base focus:ring-gray-500 focus:border-gray-600 transition-colors ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
        } ${className}`.trim()}
        {...props}
      />
      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;