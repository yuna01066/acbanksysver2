
import PanelCalculator from './PanelCalculator';

interface CalculatorWidgetProps {
  initialType?: 'quote' | 'yield' | null;
}

const CalculatorWidget = ({ initialType = null }: CalculatorWidgetProps) => {
  return (
    <div className="w-full min-h-screen">
      <PanelCalculator initialType={initialType} />
    </div>
  );
};

export default CalculatorWidget;
