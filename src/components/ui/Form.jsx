import { forwardRef } from 'react';

const Form = forwardRef(({ 
  onSubmit,
  children,
  className = "",
  spacing = "md",
  ...props 
}, ref) => {
  // Spacing configurations
  const spacings = {
    sm: "space-y-3 sm:space-y-4",
    md: "space-y-4 sm:space-y-6", 
    lg: "space-y-6 sm:space-y-8"
  };

  const spacingClass = spacings[spacing] || spacings.md;

  return (
    <form
      ref={ref}
      onSubmit={onSubmit}
      className={`${spacingClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </form>
  );
});

Form.displayName = 'Form';

export default Form;