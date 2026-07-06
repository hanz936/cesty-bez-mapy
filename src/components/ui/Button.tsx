import React from 'react';
import type { ComponentProps } from 'react';

// 'outline' used at real call sites (PlanYourDreamTrip.jsx, SalzburgItinerary.jsx) but the
// `variants` lookup below never defined it — see ledger (Nálezy) for details; preserved as-is.
type ButtonVariant = 'primary' | 'secondary' | 'green' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const Button = React.memo(({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...props
}: ButtonProps) => {
  const baseClasses = "font-medium rounded-lg transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer";

  const variants = {
    primary: "bg-green-800 hover:bg-green-900 text-white focus-visible:ring-green-500",
    secondary: "bg-gray-50 hover:bg-gray-100 text-gray-900 focus-visible:ring-gray-500",
    green: "bg-green-800 hover:bg-green-900 text-white focus-visible:ring-green-600"
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "py-3 px-4 text-sm min-h-[44px]",
    md: "py-3 px-6 min-h-[48px]",
    lg: "py-4 px-8 text-lg min-h-[52px]",
    xl: "py-5 px-10 text-xl min-h-[56px]"
  };

  const widthClass = fullWidth ? 'w-full justify-center' : '';
  // Type assertion: `variant` includes 'outline' (real call-site usage) but `variants` never
  // defined that key — pre-existing latent behavior (indexes to `undefined`, ledgered), not fixed here.
  const classes = `${baseClasses} ${variants[variant as keyof typeof variants]} ${sizes[size]} ${widthClass} ${className}`.trim();

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;