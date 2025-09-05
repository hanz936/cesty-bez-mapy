import React from 'react';

const Button = React.memo(({ 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  children, 
  className = '',
  ...props 
}) => {
  const baseClasses = "font-medium rounded-lg transition-colors duration-200 focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-offset-2 cursor-pointer";
  
  const variants = {
    primary: "bg-green-600 hover:bg-green-700 text-white supports-hover:focus-visible:ring-green-500",
    secondary: "bg-gray-50 hover:bg-gray-100 text-gray-900 supports-hover:focus-visible:ring-gray-500",
    green: "bg-green-800 hover:bg-green-900 text-white supports-hover:focus-visible:ring-green-600"
  };
  
  const sizes = {
    sm: "py-2 px-3 text-sm",
    md: "py-2 px-4",
    lg: "py-3 px-6 text-lg",
    xl: "py-4 px-8 text-xl"
  };
  
  const widthClass = fullWidth ? 'w-full justify-center' : '';
  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`.trim();
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;