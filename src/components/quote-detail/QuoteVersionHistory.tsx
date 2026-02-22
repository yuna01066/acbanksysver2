import React, { useState } from 'react';
import { useQuoteVersions, QuoteVersion } from '@/hooks/useQuoteVersions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatPrice } from '@/utils/priceCalculations';

interface Props {
  quoteId: string;
}

const QuoteVersionHistory: React.FC<Props> = ({ quoteId }) => {
  const { versions, isLoading } = useQuoteVersions(quoteId);
  const [expanded, setExpanded] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<QuoteVersion | null>(null);

  if (isLoading) return null;
  if (versions.length === 0) {
    return (
      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            수정 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">수정 이력이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const displayVersions = expanded ? versions : versions.slice(0, 3);

  return (
    <>
      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            수정 이력
            <Badge variant="secondary" className="text-[10px] ml-auto">{versions.length}건</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className={expanded ? 'max-h-[300px]' : ''}>
            <div className="space-y-2">
              {displayVersions.map((v) => (
                <div key={v.id} className="flex items-start gap-2 p-2 rounded-lg border bg-card text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">v{v.version_number}</Badge>
                      <span className="font-medium">{v.changed_by_name}</span>
                    </div>
                    {v.change_summary && (
                      <p className="text-muted-foreground mt-0.5 truncate">{v.change_summary}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {format(new Date(v.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                      {' · '}
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ko })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setSelectedVersion(v)}
                  >
                    <Eye className="w-3 h-3 mr-1" /> 보기
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          {versions.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs h-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              {expanded ? '접기' : `${versions.length - 3}건 더 보기`}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              v{selectedVersion?.version_number} 스냅샷
              <span className="text-xs text-muted-foreground ml-2">
                {selectedVersion && format(new Date(selectedVersion.created_at), 'yyyy.MM.dd HH:mm')}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedVersion?.snapshot && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground text-xs">프로젝트명</span>
                  <p className="font-medium">{selectedVersion.snapshot.project_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">거래처</span>
                  <p className="font-medium">{selectedVersion.snapshot.recipient_company || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">합계</span>
                  <p className="font-medium">{formatPrice(selectedVersion.snapshot.total || 0)}원</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">품목 수</span>
                  <p className="font-medium">{(selectedVersion.snapshot.items as any[])?.length || 0}건</p>
                </div>
              </div>
              {selectedVersion.change_summary && (
                <div>
                  <span className="text-muted-foreground text-xs">변경 내용</span>
                  <p>{selectedVersion.change_summary}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuoteVersionHistory;
