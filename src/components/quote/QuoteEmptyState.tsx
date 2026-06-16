import { ArrowLeft, Calculator, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QuoteEmptyStateProps {
  onBackToCalculator: () => void;
  title?: string;
  description?: string;
}

const QuoteEmptyState = ({
  onBackToCalculator,
  title = "담긴 견적이 없습니다.",
  description = "계산기에서 항목을 추가하면 이곳에서 발행 전 견적을 확인할 수 있습니다.",
}: QuoteEmptyStateProps) => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <Card className="w-full max-w-[680px] rounded-lg border border-border bg-card shadow-none">
        <CardContent className="px-6 py-8 text-center sm:px-10 sm:py-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
            <ShoppingCart className="h-7 w-7" />
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-xl font-semibold tracking-tight text-foreground">{title}</p>
            <p className="mx-auto max-w-full text-sm leading-6 text-muted-foreground sm:whitespace-nowrap">
              {description}
            </p>
          </div>
          <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={onBackToCalculator}
              className="h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-none hover:bg-foreground/90"
            >
              <Calculator className="h-4 w-4" />
              계산기로 돌아가기
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
              className="h-11 rounded-full border-border bg-card px-5 text-sm font-medium shadow-none hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              이전 화면
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default QuoteEmptyState;
