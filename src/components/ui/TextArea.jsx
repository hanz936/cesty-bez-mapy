import { forwardRef } from 'react';

const TextArea = forwardRef(({ 
  label, 
  error, 
  required = false, 
  className = "", 
  id,
  rows = 4,
  ...props 
}, ref) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="space-y-2">
      {label && (
        <label 
          htmlFor={textareaId} 
          className="block text-sm font-medium text-black"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`input-base bg-white w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base focus:ring-gray-500 focus:border-gray-600 transition-colors resize-none min-h-[100px] sm:min-h-[120px] ${
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

TextArea.displayName = 'TextArea';

export default TextArea;