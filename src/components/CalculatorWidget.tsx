
import PanelCalculator from './PanelCalculator';

interface CalculatorWidgetProps {
  initialType?: 'quote' | 'yield';
}

const CalculatorWidget = ({ initialType = 'quote' }: CalculatorWidgetProps) => {
  return (
    <div className="w-full">
      <PanelCalculator initialType={initialType} />
    </div>
  );
};

export default CalculatorWidget;
