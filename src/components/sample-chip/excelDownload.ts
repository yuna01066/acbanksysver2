import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function downloadInventoryExcel() {
  try {
    const { data, error } = await supabase
      .from('sample_chip_inventory')
      .select('*, panel_masters(name, quality, material)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      toast.error('다운로드할 재고 데이터가 없습니다.');
      return;
    }

    const rows = data.map((item: any) => ({
      '제품명': item.panel_masters?.name || '',
      '품질': item.panel_masters?.quality || '',
      '소재': item.panel_masters?.material || '',
      '색상명': item.color_name,
      '색상코드': item.color_code || '',
      '재고(EA)': item.stock_ea,
      '재고(SET)': item.stock_set,
      '최소재고(EA)': item.min_stock_ea,
      '최소재고(SET)': item.min_stock_set,
      '메모': item.memo || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // 제품명
      { wch: 10 }, // 품질
      { wch: 10 }, // 소재
      { wch: 20 }, // 색상명
      { wch: 12 }, // 색상코드
      { wch: 10 }, // 재고EA
      { wch: 10 }, // 재고SET
      { wch: 12 }, // 최소재고EA
      { wch: 12 }, // 최소재고SET
      { wch: 30 }, // 메모
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '샘플칩 재고');

    const now = new Date();
    const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `샘플칩_재고_${dateStr}.xlsx`);
    toast.success('엑셀 파일이 다운로드되었습니다.');
  } catch (err: any) {
    toast.error('다운로드 실패: ' + (err.message || '알 수 없는 오류'));
  }
}

export function downloadExcelTemplate() {
  const templateRows = [
    {
      '색상명': '예시: 투명 아크릴',
      '색상코드': 'AC-C001',
      '재고EA': 100,
      '재고SET': 10,
      '최소재고EA': 20,
      '최소재고SET': 5,
      '메모': '샘플용',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);
  ws['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '템플릿');
  XLSX.writeFile(wb, '샘플칩_재고_템플릿.xlsx');
  toast.success('템플릿 파일이 다운로드되었습니다.');
}
