import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import acbankLogoText from '@/assets/acbank-logo-text.png';

type HomeLogoButtonProps = {
  className?: string;
  size?: 'sm' | 'default';
};

const HomeLogoButton = ({ className, size = 'sm' }: HomeLogoButtonProps) => {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={() => navigate('/')}
      aria-label="홈으로 이동"
      title="홈으로 이동"
      className={cn(
        'h-10 rounded-2xl border border-blue-100 bg-white/90 px-3 shadow-sm transition-all hover:border-blue-200 hover:bg-white hover:shadow-md',
        size === 'default' && 'h-11 px-4',
        className
      )}
    >
      <img src={acbankLogoText} alt="ACBANK" className="h-4 w-auto object-contain" />
    </Button>
  );
};

export default HomeLogoButton;
