import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import { CASTING_QUALITIES } from '@/types/calculator';

interface ThicknessPriceManagerProps {
  qualityId: string;
  sizeId: string;
  sizeName: string;
  productName: string;
  onBack: () => void;
}

export function ThicknessPriceManager({ qualityId, sizeId, sizeName, productName, onBack }: ThicknessPriceManagerProps) {
  // Use CASTING_QUALITIES from calculator as the source of truth
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const thicknesses = quality?.thicknesses || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{productName} - {sizeName} - 두께별 가격</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>두께</TableHead>
              <TableHead>가격 (원)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {thicknesses.map((thickness) => (
              <TableRow key={thickness}>
                <TableCell className="font-medium">{thickness}</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {thicknesses.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            두께 정보가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
