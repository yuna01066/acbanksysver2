import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, HardDrive, RefreshCw, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface BucketUsage {
  name: string;
  fileCount: number;
  totalSize: number;
}

const TOTAL_FREE_STORAGE = 1 * 1024 * 1024 * 1024; // 1GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const StorageStatusPage = () => {
  const navigate = useNavigate();
  const { userRole, loading: authLoading } = useAuth();
  const [bucketUsages, setBucketUsages] = useState<BucketUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStorageUsage = async () => {
    setLoading(true);
    try {
      const bucketNames = [
        'quote-attachments',
        'quote-pdfs',
        'recipient-documents',
        'avatars',
        'employee-documents',
        'incident-attachments',
        'project-update-attachments',
        'team-chat-attachments',
        'tax-documents',
      ];

      const results: BucketUsage[] = [];

      for (const bucket of bucketNames) {
        try {
          const { data, error } = await supabase.storage.from(bucket).list('', {
            limit: 10000,
          });

          if (error) {
            results.push({ name: bucket, fileCount: 0, totalSize: 0 });
            continue;
          }

          const files = (data || []).filter(f => f.name && !f.id?.includes('/'));
          let totalSize = 0;
          let fileCount = 0;

          for (const file of files) {
            if (file.metadata?.size) {
              totalSize += file.metadata.size;
              fileCount++;
            } else if (file.name) {
              fileCount++;
            }
          }

          results.push({ name: bucket, fileCount, totalSize });
        } catch {
          results.push({ name: bucket, fileCount: 0, totalSize: 0 });
        }
      }

      setBucketUsages(results);
    } catch (err) {
      console.error('Storage usage fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
      return;
    }
    if (!authLoading) {
      fetchStorageUsage();
    }
  }, [authLoading, userRole]);

  const totalUsed = bucketUsages.reduce((sum, b) => sum + b.totalSize, 0);
  const usagePercent = Math.min((totalUsed / TOTAL_FREE_STORAGE) * 100, 100);

  const bucketLabels: Record<string, string> = {
    'quote-attachments': '견적서 첨부',
    'quote-pdfs': '견적서 PDF',
    'recipient-documents': '거래처 문서',
    'avatars': '프로필 사진',
    'employee-documents': '직원 문서',
    'incident-attachments': '사건 첨부',
    'project-update-attachments': '프로젝트 업데이트',
    'team-chat-attachments': '팀 채팅 첨부',
    'tax-documents': '연말정산 문서',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-3xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate('/admin-settings')} className="flex items-center gap-2" size="sm">
            <ArrowLeft className="w-4 h-4" />
            관리자 설정
          </Button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6" />
            데이터 스토리지 현황
          </h1>
          <Button variant="outline" size="sm" onClick={fetchStorageUsage} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* 전체 사용량 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">전체 사용량</CardTitle>
            <CardDescription>Lovable Cloud 스토리지 (무료 1GB)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">조회 중...</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{formatBytes(totalUsed)}</span>
                  <span className="text-sm text-muted-foreground">/ {formatBytes(TOTAL_FREE_STORAGE)}</span>
                </div>
                <Progress value={usagePercent} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {usagePercent.toFixed(1)}% 사용 · 잔여 {formatBytes(TOTAL_FREE_STORAGE - totalUsed)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 버킷별 사용량 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">버킷별 사용량</CardTitle>
            <CardDescription>카테고리별 파일 저장 현황</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">조회 중...</div>
            ) : (
              <div className="space-y-3">
                {bucketUsages
                  .sort((a, b) => b.totalSize - a.totalSize)
                  .map((bucket) => (
                    <div key={bucket.name} className="flex items-center gap-3 p-3 rounded-lg border">
                      <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {bucketLabels[bucket.name] || bucket.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          파일 {bucket.fileCount}개
                        </p>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground shrink-0">
                        {formatBytes(bucket.totalSize)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          💡 대용량 파일은 GCS(Google Cloud Storage)로 자동 오프로드됩니다.
        </p>
      </div>
    </div>
  );
};

export default StorageStatusPage;
