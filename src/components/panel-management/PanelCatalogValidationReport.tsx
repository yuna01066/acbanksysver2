import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePanelCatalog } from '@/hooks/usePanelCatalog';

export const PanelCatalogValidationReport = () => {
  const { qualities, sizes, colors, surcharges, isLoading, error } = usePanelCatalog();

  const missingPriceSizes = sizes.filter(size => size.is_active && (!size.price || size.price <= 0));
  const missingDimensionSizes = sizes.filter(size => size.is_active && (!size.actual_width || !size.actual_height));
  const inactiveSizes = sizes.filter(size => !size.is_active);
  const activeColors = colors.filter(color => color.is_active && color.is_producible !== false);
  const blockedColors = colors.filter(color => color.is_producible === false);
  const activeSurcharges = surcharges.filter(surcharge => surcharge.is_active && surcharge.cost > 0);

  const qualityNameById = new Map(qualities.map(quality => [quality.id, quality.name]));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          기준정보를 점검하는 중입니다.
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-destructive">
          기준정보 점검 실패: {error.message}
        </CardContent>
      </Card>
    );
  }

  const hasBlockingIssues = missingPriceSizes.length > 0 || missingDimensionSizes.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            원판·컬러 기준정보 검증 리포트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">활성 원장 조합</div>
              <div className="mt-1 text-2xl font-semibold">{sizes.filter(size => size.is_active).length.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">단가 미등록</div>
              <div className="mt-1 text-2xl font-semibold text-amber-600">{missingPriceSizes.length.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">활성 컬러</div>
              <div className="mt-1 text-2xl font-semibold">{activeColors.length.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">활성 추가금</div>
              <div className="mt-1 text-2xl font-semibold">{activeSurcharges.length.toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            {hasBlockingIssues ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>단가 또는 실제 치수가 없는 활성 원장은 계산기에서 차단됩니다.</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>활성 원장 기준정보에 치수와 단가가 모두 등록되어 있습니다.</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">계산 차단 대상</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품질</TableHead>
                <TableHead>두께</TableHead>
                <TableHead>원장</TableHead>
                <TableHead>실제 치수</TableHead>
                <TableHead>단가</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...missingPriceSizes, ...missingDimensionSizes].slice(0, 40).map(size => (
                <TableRow key={`${size.id}`}>
                  <TableCell>{qualityNameById.get(size.panel_master_id) || size.panel_master_id.slice(0, 8)}</TableCell>
                  <TableCell>{size.thickness}</TableCell>
                  <TableCell>{size.size_name}</TableCell>
                  <TableCell>{size.actual_width && size.actual_height ? `${size.actual_width}×${size.actual_height}` : '-'}</TableCell>
                  <TableCell>{size.price ? `₩${size.price.toLocaleString()}` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {!size.price || size.price <= 0 ? '단가 미등록' : '치수 미등록'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {missingPriceSizes.length === 0 && missingDimensionSizes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    계산 차단 대상이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">참고 현황</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-semibold">비활성 원장</div>
            <div className="mt-1 text-muted-foreground">{inactiveSizes.length.toLocaleString()}개 조합은 계산기와 수율계산기에 노출되지 않습니다.</div>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <div className="font-semibold">생산 불가 컬러</div>
            <div className="mt-1 text-muted-foreground">{blockedColors.length.toLocaleString()}개 컬러는 색상 선택에서 제외됩니다.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
