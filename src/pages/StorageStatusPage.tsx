import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, HardDrive, RefreshCw, FolderOpen, Cloud, Database, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BucketUsage {
  name: string;
  fileCount: number;
  totalSize: number;
}

interface GcsFileInfo {
  name: string;
  size: string;
  lastModified: string;
}

const LOVABLE_FREE_STORAGE = 1 * 1024 * 1024 * 1024; // 1GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const StorageStatusPage = () => {
  const navigate = useNavigate();
  const { userRole, loading: authLoading } = useAuth();

  // Lovable Cloud (Supabase Storage)
  const [bucketUsages, setBucketUsages] = useState<BucketUsage[]>([]);
  const [lovableLoading, setLovableLoading] = useState(true);

  // Supabase DB
  const [dbSize, setDbSize] = useState<string>('');
  const [dbLoading, setDbLoading] = useState(true);
  const [tableSizes, setTableSizes] = useState<{ name: string; size: string; rows: number }[]>([]);

  // GCS
  const [gcsFiles, setGcsFiles] = useState<GcsFileInfo[]>([]);
  const [gcsTotalSize, setGcsTotalSize] = useState(0);
  const [gcsLoading, setGcsLoading] = useState(true);

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

  const fetchLovableStorage = useCallback(async () => {
    setLovableLoading(true);
    try {
      const bucketNames = Object.keys(bucketLabels);
      const results: BucketUsage[] = [];

      for (const bucket of bucketNames) {
        try {
          const { data, error } = await supabase.storage.from(bucket).list('', { limit: 10000 });
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
      console.error('Lovable storage fetch error:', err);
    } finally {
      setLovableLoading(false);
    }
  }, []);

  const fetchDbSize = useCallback(async () => {
    setDbLoading(true);
    try {
      // Get table row counts from known tables
      const tables = [
        'profiles', 'saved_quotes', 'recipients', 'projects', 'attendance_records',
        'leave_requests', 'announcements', 'direct_messages', 'material_orders',
        'employment_contracts', 'performance_reviews', 'incident_reports',
        'project_updates', 'notifications', 'activity_logs',
      ];
      const sizes: { name: string; size: string; rows: number }[] = [];
      for (const table of tables) {
        try {
          const { count } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
          sizes.push({ name: table, size: '', rows: count || 0 });
        } catch {
          // skip
        }
      }
      setTableSizes(sizes.filter(s => s.rows > 0).sort((a, b) => b.rows - a.rows));

      const totalRows = sizes.reduce((sum, s) => sum + s.rows, 0);
      setDbSize(`${totalRows.toLocaleString()} rows`);
    } catch (err) {
      console.error('DB size fetch error:', err);
    } finally {
      setDbLoading(false);
    }
  }, []);

  const fetchGcsStorage = useCallback(async () => {
    setGcsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('gcs-storage', {
        body: { action: 'list-files', bucket: 'acbank_sys2', prefix: '' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.data?.items) {
        const items: GcsFileInfo[] = res.data.items;
        setGcsFiles(items);
        const total = items.reduce((sum: number, f: GcsFileInfo) => sum + (parseInt(f.size) || 0), 0);
        setGcsTotalSize(total);
      }
    } catch (err) {
      console.error('GCS storage fetch error:', err);
    } finally {
      setGcsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchLovableStorage();
    fetchDbSize();
    fetchGcsStorage();
  }, [fetchLovableStorage, fetchDbSize, fetchGcsStorage]);

  useEffect(() => {
    if (!authLoading && userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
      return;
    }
    if (!authLoading) {
      refreshAll();
    }
  }, [authLoading, userRole]);

  const lovableTotalUsed = bucketUsages.reduce((sum, b) => sum + b.totalSize, 0);
  const lovablePercent = Math.min((lovableTotalUsed / LOVABLE_FREE_STORAGE) * 100, 100);
  const isLoading = lovableLoading || dbLoading || gcsLoading;

  const tableLabels: Record<string, string> = {
    profiles: '사용자 프로필',
    saved_quotes: '저장된 견적서',
    recipients: '거래처',
    projects: '프로젝트',
    attendance_records: '근태 기록',
    leave_requests: '휴가 신청',
    announcements: '공지사항',
    direct_messages: '메시지',
    material_orders: '원판 발주',
    employment_contracts: '근로 계약',
    performance_reviews: '업무 평가',
    incident_reports: '사건 보고서',
    project_updates: '프로젝트 업데이트',
    notifications: '알림',
    activity_logs: '활동 로그',
  };

  // Group GCS files by prefix
  const gcsGroups: Record<string, { count: number; size: number }> = {};
  gcsFiles.forEach(f => {
    const prefix = f.name.split('/')[0] || 'root';
    if (!gcsGroups[prefix]) gcsGroups[prefix] = { count: 0, size: 0 };
    gcsGroups[prefix].count++;
    gcsGroups[prefix].size += parseInt(f.size) || 0;
  });

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
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* 요약 카드 3개 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Lovable Cloud</span>
              </div>
              {lovableLoading ? (
                <div className="text-sm text-muted-foreground">조회 중...</div>
              ) : (
                <>
                  <p className="text-lg font-bold">{formatBytes(lovableTotalUsed)}</p>
                  <Progress value={lovablePercent} className="h-1.5 mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    / 1GB · 잔여 {formatBytes(LOVABLE_FREE_STORAGE - lovableTotalUsed)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Database</span>
              </div>
              {dbLoading ? (
                <div className="text-sm text-muted-foreground">조회 중...</div>
              ) : (
                <>
                  <p className="text-lg font-bold">{dbSize}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {tableSizes.length}개 테이블 사용 중
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Google Cloud</span>
              </div>
              {gcsLoading ? (
                <div className="text-sm text-muted-foreground">조회 중...</div>
              ) : (
                <>
                  <p className="text-lg font-bold">{formatBytes(gcsTotalSize)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    파일 {gcsFiles.length}개 · acbank_sys2
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 탭별 상세 */}
        <Tabs defaultValue="lovable" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="lovable">Lovable Cloud</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="gcs">Google Cloud</TabsTrigger>
          </TabsList>

          <TabsContent value="lovable">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">파일 스토리지 버킷</CardTitle>
                <CardDescription>Lovable Cloud 스토리지 (무료 1GB)</CardDescription>
              </CardHeader>
              <CardContent>
                {lovableLoading ? (
                  <div className="text-sm text-muted-foreground">조회 중...</div>
                ) : (
                  <div className="space-y-2">
                    {bucketUsages
                      .sort((a, b) => b.totalSize - a.totalSize)
                      .map((bucket) => (
                        <div key={bucket.name} className="flex items-center gap-3 p-3 rounded-lg border">
                          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {bucketLabels[bucket.name] || bucket.name}
                            </p>
                            <p className="text-xs text-muted-foreground">파일 {bucket.fileCount}개</p>
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
          </TabsContent>

          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">데이터베이스 테이블</CardTitle>
                <CardDescription>테이블별 레코드 수</CardDescription>
              </CardHeader>
              <CardContent>
                {dbLoading ? (
                  <div className="text-sm text-muted-foreground">조회 중...</div>
                ) : tableSizes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">데이터가 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {tableSizes.map((table) => (
                      <div key={table.name} className="flex items-center gap-3 p-3 rounded-lg border">
                        <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tableLabels[table.name] || table.name}
                          </p>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground shrink-0">
                          {table.rows.toLocaleString()} rows
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gcs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Google Cloud Storage</CardTitle>
                <CardDescription>acbank_sys2 버킷 · 폴더별 사용량</CardDescription>
              </CardHeader>
              <CardContent>
                {gcsLoading ? (
                  <div className="text-sm text-muted-foreground">조회 중...</div>
                ) : Object.keys(gcsGroups).length === 0 ? (
                  <div className="text-sm text-muted-foreground">파일이 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(gcsGroups)
                      .sort(([, a], [, b]) => b.size - a.size)
                      .map(([prefix, info]) => (
                        <div key={prefix} className="flex items-center gap-3 p-3 rounded-lg border">
                          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{prefix}/</p>
                            <p className="text-xs text-muted-foreground">파일 {info.count}개</p>
                          </div>
                          <span className="text-sm font-mono text-muted-foreground shrink-0">
                            {formatBytes(info.size)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StorageStatusPage;
