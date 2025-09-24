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
    primary: "bg-green-800 hover:bg-green-900 text-white supports-hover:focus-visible:ring-green-500",
    secondary: "bg-gray-50 hover:bg-gray-100 text-gray-900 supports-hover:focus-visible:ring-gray-500",
    green: "bg-green-800 hover:bg-green-900 text-white supports-hover:focus-visible:ring-green-600"
  };
  
  const sizes = {
    sm: "py-3 px-4 text-sm min-h-[44px]",
    md: "py-3 px-6 min-h-[48px]",
    lg: "py-4 px-8 text-lg min-h-[52px]",
    xl: "py-5 px-10 text-xl min-h-[56px]"
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