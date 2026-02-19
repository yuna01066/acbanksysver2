import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function downloadInventoryExcel() {
  try {
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('sample_chip_inventory')
        .select('*, panel_masters(name, quality, material)')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (allData.length === 0) {
      toast.error('다운로드할 재고 데이터가 없습니다.');
      return;
    }

    const rows = allData.map((item: any, idx: number) => ({
      '상품번호': idx + 1,
      '상품명': item.color_name || '',
      '자체 상품코드': item.color_code || '',
      '카테고리ID': '',
      '판매상태': '',
      '상품상태': '',
      '진열상태': '',
      '판매가': '',
      '무게': '',
      '정가': '',
      '원가': '',
      '재고사용': item.stock_ea > 0 || item.stock_set > 0 ? 'Y' : 'N',
      '현재 재고수량': item.stock_ea,
      '재고번호SKU': '',
      '메모': item.memo || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws['!cols'] = [
      { wch: 10 }, // 상품번호
      { wch: 30 }, // 상품명
      { wch: 15 }, // 자체 상품코드
      { wch: 12 }, // 카테고리ID
      { wch: 10 }, // 판매상태
      { wch: 10 }, // 상품상태
      { wch: 10 }, // 진열상태
      { wch: 10 }, // 판매가
      { wch: 8 },  // 무게
      { wch: 10 }, // 정가
      { wch: 10 }, // 원가
      { wch: 10 }, // 재고사용
      { wch: 15 }, // 현재 재고수량
      { wch: 15 }, // 재고번호SKU
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
