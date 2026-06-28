import { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { useListboxKeyboard } from '../../hooks/useListboxKeyboard';

const Dropdown = forwardRef(({
  label,
  error,
  required = false,
  size = 'md',
  placeholder = "Vybrat...",
  value,
  onChange,
  options = [],
  disabled = false,
  className = "",
  showLabel = true,
  minWidth,
  fullWidth = true,
  closeOnSelect = true,
  id,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownId = id || `dropdown-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${dropdownId}-label`;
  const listboxId = `${dropdownId}-listbox`;
  const optionId = (index) => `${dropdownId}-opt-${index}`;

  // Find selected option
  const selectedOption = options.find(option => (option.value || option) === selectedValue);
  const displayText = selectedOption ? (selectedOption.label || selectedOption) : placeholder;

  // Handle option selection
  const handleOptionSelect = useCallback((option) => {
    const optionValue = option.value || option;
    setSelectedValue(optionValue);

    if (closeOnSelect) {
      setIsOpen(false);
    }

    if (onChange) {
      // Create synthetic event to match native select behavior
      const syntheticEvent = {
        target: { value: optionValue },
        currentTarget: { value: optionValue }
      };
      onChange(syntheticEvent);
    }
  }, [onChange, closeOnSelect]);

  const { activeIndex, setActiveIndex, onKeyDown } = useListboxKeyboard({
    isOpen,
    setIsOpen,
    options,
    getOptionValue: (o) => o.value ?? o,
    value: selectedValue,
    onSelect: handleOptionSelect,
    triggerRef,
  });

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        const selectedIdx = options.findIndex((option) => (option.value ?? option) === selectedValue);
        setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
      }
      return next;
    });
  }, [disabled, options, selectedValue, setActiveIndex]);

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

  // Unified styles - consistent across all dropdowns
  const baseStyles = "bg-white border-gray-300 text-black hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-500 focus:border-gray-600";

  // Size configurations
  const sizes = {
    sm: {
      button: "px-4 py-2 text-sm font-medium",
      dropdown: "text-sm",
      icon: "h-4 w-4"
    },
    md: {
      button: "px-4 py-3 text-base",
      dropdown: "text-sm",
      icon: "h-4 w-4"
    }
  };

  // Get current size config
  const sizeConfig = sizes[size] || sizes.md;

  const hasLabel = Boolean(label && showLabel);

  return (
    <div className="space-y-2">
      {hasLabel && (
        <label
          id={labelId}
          className="block text-sm font-medium text-black"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative" ref={dropdownRef}>
        <div
          role="combobox"
          ref={(node) => {
            triggerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          id={dropdownId}
          tabIndex={disabled ? -1 : 0}
          onClick={toggleDropdown}
          onKeyDown={onKeyDown}
          className={`
            flex items-center justify-between border rounded-lg cursor-pointer transition-all duration-200 shadow-sm text-left
            ${baseStyles}
            ${sizeConfig.button}
            ${fullWidth ? 'w-full' : minWidth ? `min-w-[${minWidth}]` : 'w-auto'}
            ${error ? 'border-red-300 hover:border-red-400 focus:border-red-500 focus:ring-red-500' : ''}
            ${isOpen ? 'ring-2' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-white hover:border-gray-300' : ''}
            ${className}
          `.replace(/\s+/g, ' ').trim()}
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-disabled={disabled || undefined}
          {...(hasLabel ? { 'aria-labelledby': labelId } : { 'aria-label': label })}
          aria-activedescendant={isOpen ? optionId(activeIndex) : undefined}
          {...props}
        >
          <span className={selectedValue ? 'text-black' : 'text-gray-500'}>
            {displayText}
          </span>
          <svg
            className={`ml-2 ${sizeConfig.icon} text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} flex-shrink-0`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            role="listbox"
            id={listboxId}
            aria-labelledby={hasLabel ? labelId : undefined}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden"
          >
            {options.length > 0 ? (
              options.map((option, index) => {
                const optionValue = option.value || option;
                const optionLabel = option.label || option;
                const isSelected = optionValue === selectedValue;
                const isActive = index === activeIndex;

                return (
                  <div
                    key={index}
                    id={optionId(index)}
                    onClick={() => handleOptionSelect(option)}
                    className={`
                      w-full text-left px-4 py-3 transition-colors duration-150 cursor-pointer
                      ${sizeConfig.dropdown}
                      ${isSelected
                        ? 'bg-gray-100 text-black font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                      ${isActive ? 'ring-2 ring-inset ring-gray-500' : ''}
                    `.replace(/\s+/g, ' ').trim()}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {optionLabel}
                  </div>
                );
              })
            ) : (
              <div className={`px-4 py-3 text-gray-500 ${sizeConfig.dropdown}`}>
                Žádné možnosti
              </div>
            )}
          </div>
        )}

        {/* Backdrop for mobile - close on tap outside */}
        {isOpen && (
          <div
            className="fixed inset-0 z-10 md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
});

Dropdown.displayName = 'Dropdown';

export default Dropdown;
