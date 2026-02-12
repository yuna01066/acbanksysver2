import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CorpState {
  corpNum: string;
  taxType: string | null;
  typeDate: string | null;
  state: string | null;
  stateDate: string | null;
  checkDate: string | null;
}

interface CorpStatusCheckProps {
  /** 초기 사업자번호 값 */
  initialCorpNum?: string;
  /** 조회 결과 콜백 */
  onResult?: (result: CorpState | null) => void;
  /** 컴팩트 모드 (인라인 표시) */
  compact?: boolean;
}

const TAX_TYPE_MAP: Record<string, string> = {
  '10': '일반과세자',
  '20': '면세과세자',
  '30': '간이과세자',
  '31': '간이과세자(세금계산서 발급)',
  '40': '비영리법인/국가기관',
};

const STATE_MAP: Record<string, { label: string; color: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  '0': { label: '미등록', color: 'destructive' },
  '1': { label: '사업중', color: 'default' },
  '2': { label: '폐업', color: 'destructive' },
  '3': { label: '휴업', color: 'secondary' },
};

const CorpStatusCheck: React.FC<CorpStatusCheckProps> = ({
  initialCorpNum = '',
  onResult,
  compact = false,
}) => {
  const [corpNum, setCorpNum] = useState(initialCorpNum.replace(/-/g, ''));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorpState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatCorpNum = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setCorpNum(raw);
    setResult(null);
    setError(null);
  };

  const handleCheck = async () => {
    if (corpNum.length !== 10) {
      toast.error('사업자번호 10자리를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      const response = await supabase.functions.invoke('popbill-api', {
        body: { action: 'checkCorpNum', checkCorpNum: corpNum },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || '조회 실패');

      const corpState: CorpState = response.data.data;
      setResult(corpState);
      onResult?.(corpState);

      if (corpState.state === '1') {
        toast.success('사업중인 유효한 사업자번호입니다.');
      } else {
        const stateInfo = STATE_MAP[corpState.state || ''] || { label: '확인실패' };
        toast.warning(`사업자 상태: ${stateInfo.label}`);
      }
    } catch (err: any) {
      const msg = err.message || '사업자등록상태 조회에 실패했습니다.';
      setError(msg);
      toast.error(msg);
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  };

  const getStateIcon = (state: string | null) => {
    if (state === '1') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (state === '2' || state === '0') return <XCircle className="h-4 w-4 text-destructive" />;
    if (state === '3') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            value={formatCorpNum(corpNum)}
            onChange={handleInputChange}
            placeholder="000-00-00000"
            className="pr-10"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={loading || corpNum.length !== 10}
          className="shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {result && (
          <div className="flex items-center gap-1">
            {getStateIcon(result.state)}
            <Badge variant={STATE_MAP[result.state || '']?.color || 'outline'} className="text-xs">
              {STATE_MAP[result.state || '']?.label || '확인실패'}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={formatCorpNum(corpNum)}
          onChange={handleInputChange}
          placeholder="사업자번호 입력 (000-00-00000)"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleCheck}
          disabled={loading || corpNum.length !== 10}
          className="shrink-0 gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          조회
        </Button>
      </div>

      {result && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            {getStateIcon(result.state)}
            <span className="font-medium text-sm">
              {formatCorpNum(result.corpNum)}
            </span>
            <Badge variant={STATE_MAP[result.state || '']?.color || 'outline'}>
              {STATE_MAP[result.state || '']?.label || '확인실패'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">과세유형:</span>{' '}
              {TAX_TYPE_MAP[result.taxType || ''] || '확인실패'}
            </div>
            {result.typeDate && (
              <div>
                <span className="font-medium">유형전환일:</span> {result.typeDate}
              </div>
            )}
            {result.stateDate && (
              <div>
                <span className="font-medium">휴폐업일:</span> {result.stateDate}
              </div>
            )}
            {result.checkDate && (
              <div>
                <span className="font-medium">확인일:</span> {result.checkDate}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
};

export default CorpStatusCheck;
