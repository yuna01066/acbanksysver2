import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import acbankLogoOrange from '@/assets/acbank-logo-orange.png';

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
        'h-10 rounded-lg bg-transparent px-0 shadow-none transition-opacity hover:bg-transparent hover:opacity-80 active:opacity-70',
        size === 'default' && 'h-11',
        className
      )}
    >
      <img
        src={acbankLogoOrange}
        alt="ACBANK"
        className={cn(
          'h-5 w-auto object-contain drop-shadow-[0_2px_6px_rgba(255,102,24,0.16)]',
          size === 'default' && 'h-6'
        )}
      />
    </Button>
  );
};

export default HomeLogoButton;
