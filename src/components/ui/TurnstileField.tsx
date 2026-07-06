import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileProps } from '@marsidev/react-turnstile';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

interface TurnstileFieldProps {
  onVerify: TurnstileProps['onSuccess'];
  onExpire?: TurnstileProps['onExpire'];
  onError?: TurnstileProps['onError'];
}

const TurnstileField = ({ onVerify, onExpire, onError }: TurnstileFieldProps) => {
  if (!SITE_KEY) {
    if (import.meta.env.DEV) {
      console.warn(
        '[TurnstileField] VITE_TURNSTILE_SITE_KEY is not set; widget will not render.'
      );
    }
    return null;
  }

  return (
    <div className="flex justify-center mt-4 mb-2">
      <Turnstile
        siteKey={SITE_KEY}
        onSuccess={onVerify}
        onExpire={onExpire}
        onError={onError}
        options={{
          language: 'cs',
          theme: 'light',
        }}
      />
    </div>
  );
};

export default TurnstileField;
