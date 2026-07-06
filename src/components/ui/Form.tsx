import { forwardRef } from 'react';
import type { ComponentProps } from 'react';

type FormSpacing = 'sm' | 'md' | 'lg';

interface FormProps extends ComponentProps<'form'> {
  spacing?: FormSpacing;
}

const Form = forwardRef<HTMLFormElement, FormProps>(({
  onSubmit,
  children,
  className = "",
  spacing = "md",
  ...props
}, ref) => {
  // Spacing configurations
  const spacings: Record<FormSpacing, string> = {
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