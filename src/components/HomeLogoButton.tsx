import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HomeLogoButtonProps {
  size?: 'sm' | 'default';
  className?: string;
}

const HomeLogoButton = ({ size = 'default', className }: HomeLogoButtonProps) => {
  const navigate = useNavigate();
  const isSmall = size === 'sm';

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => navigate('/')}
      className={cn(
        'rounded-[22px] border border-slate-300 bg-white/70 px-4 font-black tracking-[0.18em] text-slate-800 shadow-sm backdrop-blur transition hover:bg-white',
        isSmall ? 'h-10 text-sm' : 'h-14 text-2xl',
        className,
      )}
      aria-label="홈으로 이동"
    >
      ACBANK
    </Button>
  );
};

export default HomeLogoButton;
