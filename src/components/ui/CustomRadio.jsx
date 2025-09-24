import React from 'react';

const CustomRadio = React.memo(({
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
        {/* Hidden native radio for accessibility */}
        <input
          id={id}
          name={name}
          type="radio"
          value={value}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
          {...props}
        />

        {/* Custom radio */}
        <div className={`
          w-5 h-5 rounded-full border-2 transition-all duration-200 ease-in-out
          flex items-center justify-center
          ${checked
            ? 'bg-white border-green-800 shadow-sm'
            : 'bg-white border-gray-300 hover:border-green-800'
          }
          ${!disabled && 'group-hover:shadow-sm'}
          ${disabled ? 'bg-gray-100 border-gray-200' : ''}
          focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-1
        `}>
          {/* Radio dot */}
          <div className={`
            w-2.5 h-2.5 rounded-full bg-green-800 transition-all duration-200 ease-in-out
            ${checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
          `} />
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

CustomRadio.displayName = 'CustomRadio';

export default CustomRadio;