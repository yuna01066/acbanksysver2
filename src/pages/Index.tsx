
import CalculatorWidget from "@/components/CalculatorWidget";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="relative overflow-hidden">
        {/* Apple-style background elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-apple-float" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-apple-float" style={{ animationDelay: '2s' }} />
        </div>
        
        <CalculatorWidget />
      </div>
    </div>
  );
};

export default Index;
