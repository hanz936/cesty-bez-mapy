import { forwardRef, useState, useCallback, useRef, useEffect } from 'react';

const Select = forwardRef(({ 
  label, 
  error, 
  required = false, 
  className = "", 
  id,
  options = [],
  value,
  onChange,
  placeholder = "Vybrat..."
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const dropdownRef = useRef(null);
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  
  const selectedOption = options.find(option => (option.value || option) === selectedValue);
  const displayText = selectedOption ? (selectedOption.label || selectedOption) : placeholder;

  const handleOptionSelect = useCallback((option) => {
    const optionValue = option.value || option;
    setSelectedValue(optionValue);
    setIsOpen(false);
    
    if (onChange) {
      // Create synthetic event to match native select behavior
      const syntheticEvent = {
        target: { value: optionValue },
        currentTarget: { value: optionValue }
      };
      onChange(syntheticEvent);
    }
  }, [onChange]);

  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update selectedValue when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);
  
  return (
    <div className="space-y-2">
      {label && (
        <label 
          htmlFor={selectId} 
          className="block text-sm font-medium text-black"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative" ref={dropdownRef}>
        <button
          ref={ref}
          type="button"
          onClick={toggleDropdown}
          className={`flex items-center justify-between bg-white border rounded-lg px-4 py-3 text-base cursor-pointer transition-all duration-200 shadow-sm w-full text-left ${
            error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-500 focus:border-gray-600'
          } ${
            isOpen ? 'ring-2 ring-gray-500 border-gray-600' : ''
          } ${className}`.trim()}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={selectedValue ? 'text-black' : 'text-gray-500'}>
            {displayText}
          </span>
          <svg 
            className={`ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
            {options.map((option, index) => {
              const optionValue = option.value || option;
              const optionLabel = option.label || option;
              const isSelected = optionValue === selectedValue;
              
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleOptionSelect(option)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                    isSelected 
                      ? 'bg-gray-100 text-black font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {optionLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;