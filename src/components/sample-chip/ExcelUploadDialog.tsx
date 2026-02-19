import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface ParsedRow {
  color_name: string;
  color_code: string;
  stock_ea: number;
  stock_set: number;
  min_stock_ea: number;
  min_stock_set: number;
  memo: string;
  _raw_product_code?: string;
  _valid: boolean;
  _error?: string;
}

interface ExcelUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExcelUploadDialog: React.FC<ExcelUploadDialogProps> = ({ open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');

  const resetState = () => {
    setParsedRows([]);
    setUploading(false);
    setProgress(0);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (jsonRows.length === 0) {
        toast.error('엑셀 파일에 데이터가 없습니다.');
        return;
      }

      const headers = Object.keys(jsonRows[0]);
      const isImwebFormat = headers.includes('상품명') && headers.includes('자체 상품코드');
      const isSimpleFormat = headers.includes('색상명');

      const rows: ParsedRow[] = jsonRows.map(row => {
        if (isImwebFormat) {
          const productName = String(row['상품명'] || '').trim();
          const productCode = String(row['자체 상품코드'] || '').trim();
          const stockQty = parseInt(row['현재 재고수량']) || 0;
          return {
            color_name: productName,
            color_code: productCode,
            stock_ea: stockQty,
            stock_set: 0,
            min_stock_ea: 0,
            min_stock_set: 0,
            memo: `상품번호: ${row['상품번호'] || ''}, 카테고리: ${row['카테고리ID'] || ''}, 판매상태: ${row['판매상태'] || ''}`,
            _raw_product_code: productCode,
            _valid: !!productName,
            _error: !productName ? '상품명이 비어있습니다' : undefined,
          };
        } else if (isSimpleFormat) {
          const colorName = String(row['색상명'] || '').trim();
          return {
            color_name: colorName,
            color_code: String(row['색상코드'] || '').trim(),
            stock_ea: parseInt(row['재고EA'] || row['재고(EA)'] || '0') || 0,
            stock_set: parseInt(row['재고SET'] || row['재고(SET)'] || '0') || 0,
            min_stock_ea: parseInt(row['최소재고EA'] || row['최소재고(EA)'] || '0') || 0,
            min_stock_set: parseInt(row['최소재고SET'] || row['최소재고(SET)'] || '0') || 0,
            memo: String(row['메모'] || '').trim(),
            _valid: !!colorName,
            _error: !colorName ? '색상명이 비어있습니다' : undefined,
          };
        } else {
          // Try generic mapping with first two columns
          const values = Object.values(row);
          return {
            color_name: String(values[0] || '').trim(),
            color_code: String(values[1] || '').trim(),
            stock_ea: parseInt(String(values[2])) || 0,
            stock_set: parseInt(String(values[3])) || 0,
            min_stock_ea: 0,
            min_stock_set: 0,
            memo: '',
            _valid: !!String(values[0]).trim(),
            _error: !String(values[0]).trim() ? '첫 번째 컬럼(상품명)이 비어있습니다' : undefined,
          };
        }
      }).filter(r => r.color_name); // Filter empty rows

      setParsedRows(rows);
      toast.success(`${rows.length}개 항목이 파싱되었습니다.`);
    } catch (err: any) {
      toast.error('엑셀 파일 파싱 실패: ' + (err.message || '알 수 없는 오류'));
    }
  };

  const handleUpload = async () => {
    const validRows = parsedRows.filter(r => r._valid);
    if (validRows.length === 0) {
      toast.error('업로드할 유효한 데이터가 없습니다.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const batchSize = 500;
      let uploaded = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize).map(row => ({
          color_name: row.color_name,
          color_code: row.color_code || null,
          stock_ea: row.stock_ea,
          stock_set: row.stock_set,
          min_stock_ea: row.min_stock_ea,
          min_stock_set: row.min_stock_set,
          memo: row.memo || null,
        }));

        const { error } = await supabase
          .from('sample_chip_inventory')
          .insert(batch);

        if (error) throw error;

        uploaded += batch.length;
        setProgress(Math.round((uploaded / validRows.length) * 100));
      }

      toast.success(`${uploaded}개 항목이 성공적으로 업로드되었습니다.`);
      queryClient.invalidateQueries({ queryKey: ['sample-chip-inventory'] });
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error('업로드 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setUploading(false);
    }
  };

  const validCount = parsedRows.filter(r => r._valid).length;
  const invalidCount = parsedRows.filter(r => !r._valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            엑셀 일괄 업로드
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              엑셀 파일(.xlsx, .xls, .csv)을 선택해주세요
            </p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              파일 선택
            </Button>
            {fileName && (
              <p className="mt-2 text-sm font-medium text-foreground">{fileName}</p>
            )}
          </div>

          {/* Format info */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-semibold mb-1">지원 형식:</p>
            <p>• <b>아임웹 형식:</b> 상품명, 자체 상품코드, 현재 재고수량 컬럼 자동 인식</p>
            <p>• <b>간편 형식:</b> 색상명, 색상코드, 재고EA, 재고SET, 최소재고EA, 최소재고SET, 메모</p>
          </div>

          {/* Preview */}
          {parsedRows.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" /> 유효: {validCount}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" /> 오류: {invalidCount}
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>상품명/색상명</TableHead>
                      <TableHead>색상코드</TableHead>
                      <TableHead className="text-right">EA</TableHead>
                      <TableHead className="text-right">SET</TableHead>
                      <TableHead>메모</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx} className={!row._valid ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          {row._valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-xs text-destructive">{row._error}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{row.color_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.color_code || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.stock_ea}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{row.stock_set}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{row.memo || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center">
                  상위 100개만 표시됩니다. 총 {parsedRows.length}개
                </p>
              )}

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">{progress}% 업로드 중...</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
            취소
          </Button>
          <Button
            onClick={handleUpload}
            disabled={validCount === 0 || uploading}
          >
            {uploading ? '업로드 중...' : `${validCount}개 항목 업로드`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
