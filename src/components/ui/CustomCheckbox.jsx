import React from 'react';

const CustomCheckbox = React.memo(({
  id,
  name,
  value,
  checked = false,
  onChange,
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const handleChange = (e) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <label
      htmlFor={id}
      className={`flex items-center space-x-3 cursor-pointer group ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`.trim()}
    >
      <div className="relative">
        {/* Hidden native checkbox for accessibility */}
        <input
          id={id}
          name={name}
          type="checkbox"
          value={value}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
          {...props}
        />

        {/* Custom checkbox */}
        <div className={`
          w-5 h-5 rounded-md border-2 transition-all duration-200 ease-in-out
          flex items-center justify-center
          ${checked
            ? 'bg-green-800 border-green-800 shadow-sm'
            : 'bg-white border-gray-300 hover:border-green-800'
          }
          ${!disabled && 'group-hover:shadow-sm group-hover:scale-105'}
          ${disabled ? 'bg-gray-100 border-gray-200' : ''}
          focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-1
        `}>
          {/* Checkmark icon */}
          <svg
            className={`w-3 h-3 text-white transition-all duration-200 ease-in-out ${
              checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      {/* Label text */}
      {children && (
        <span className={`text-sm select-none transition-colors duration-200 ${
          disabled ? 'text-gray-400' : 'text-black group-hover:text-green-800'
        }`}>
          {children}
        </span>
      )}
    </label>
  );
});

CustomCheckbox.displayName = 'CustomCheckbox';

export default CustomCheckbox;