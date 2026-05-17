
import PanelCalculator from './PanelCalculator';

interface CalculatorWidgetProps {
  initialType?: 'quote' | 'yield' | null;
}

const CalculatorWidget = ({ initialType = null }: CalculatorWidgetProps) => {
  return (
    <div className="w-full">
      <PanelCalculator initialType={initialType} />
    </div>
  );
};

export default CalculatorWidget;
