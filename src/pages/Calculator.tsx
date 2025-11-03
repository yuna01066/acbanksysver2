import { useSearchParams } from 'react-router-dom';
import CalculatorWidget from "@/components/CalculatorWidget";

const Calculator = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') as 'quote' | 'yield' | null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <CalculatorWidget initialType={type} />
    </div>
  );
};

export default Calculator;
