import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, HardDrive, RefreshCw, FolderOpen, Cloud, Database, Server, Info, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

interface DriveFolderInfo {
  name: string;
  fileCount: number;
  totalSize: number;
}

const LOVABLE_FREE_STORAGE = 1 * 1024 * 1024 * 1024; // 1GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 버킷 내 모든 파일을 재귀적으로 탐색
async function listAllFiles(bucket: string, prefix: string = ''): Promise<{ count: number; size: number }> {
  let totalCount = 0;
  let totalSize = 0;

  try {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) return { count: 0, size: 0 };

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      if (item.id === null && !item.metadata) {
        // 폴더 → 재귀 탐색
        const sub = await listAllFiles(bucket, fullPath);
        totalCount += sub.count;
        totalSize += sub.size;
      } else {
        // 실제 파일
        totalCount++;
        totalSize += (item.metadata?.size || 0);
      }
    }
  } catch {
    // skip
  }

  return { count: totalCount, size: totalSize };
}

const StorageStatusPage = () => {
  const navigate = useNavigate();
  const { userRole, loading: authLoading } = useAuth();

  const [bucketUsages, setBucketUsages] = useState<BucketUsage[]>([]);
  const [lovableLoading, setLovableLoading] = useState(true);

  const [dbSize, setDbSize] = useState<string>('');
  const [dbLoading, setDbLoading] = useState(true);
  const [tableSizes, setTableSizes] = useState<{ name: string; rows: number }[]>([]);

  const [gcsFiles, setGcsFiles] = useState<GcsFileInfo[]>([]);
  const [gcsTotalSize, setGcsTotalSize] = useState(0);
  const [gcsLoading, setGcsLoading] = useState(true);

  const [driveFolders, setDriveFolders] = useState<DriveFolderInfo[]>([]);
  const [driveTotalFiles, setDriveTotalFiles] = useState(0);
  const [driveTotalSize, setDriveTotalSize] = useState(0);
  const [driveLoading, setDriveLoading] = useState(true);

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
      const promises = bucketNames.map(async (bucket) => {
        const result = await listAllFiles(bucket);
        return { name: bucket, fileCount: result.count, totalSize: result.size };
      });
      const results = await Promise.all(promises);
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
      const tables = [
        'profiles', 'saved_quotes', 'recipients', 'projects', 'attendance_records',
        'leave_requests', 'announcements', 'direct_messages', 'material_orders',
        'employment_contracts', 'performance_reviews', 'incident_reports',
        'project_updates', 'notifications', 'activity_logs', 'quote_memos',
        'project_assignments', 'peer_feedback', 'performance_review_scores',
        'performance_review_cycles', 'performance_review_categories',
        'performance_review_summaries', 'review_cycle_targets',
        'processing_options', 'processing_categories', 'panel_masters',
        'panel_sizes', 'color_options', 'color_mixing_costs', 'panel_option_surcharges',
        'company_holidays', 'company_info', 'contract_templates',
        'custom_leave_types', 'document_categories', 'employee_documents',
        'leave_policy_settings', 'leave_general_settings', 'labor_law_settings',
        'page_access_permissions', 'page_role_access', 'password_reset_requests',
        'slot_types', 'category_logic_slots', 'advanced_processing_settings',
        'tax_deduction_items', 'tax_dependents', 'year_end_tax_settlements',
        'user_roles',
      ];
      
      const promises = tables.map(async (table) => {
        try {
          const { count } = await supabase.from(table as any).select('*', { count: 'exact', head: true });
          return { name: table, rows: count || 0 };
        } catch {
          return { name: table, rows: 0 };
        }
      });
      
      const sizes = await Promise.all(promises);
      const filtered = sizes.filter(s => s.rows > 0).sort((a, b) => b.rows - a.rows);
      setTableSizes(filtered);
      
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

  const fetchDriveStorage = useCallback(async () => {
    setDriveLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('google-drive', {
        body: { action: 'list-drive-usage' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.data?.success) {
        setDriveFolders(res.data.folders || []);
        setDriveTotalFiles(res.data.totalFiles || 0);
        setDriveTotalSize(res.data.totalSize || 0);
      }
    } catch (err) {
      console.error('Google Drive fetch error:', err);
    } finally {
      setDriveLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchLovableStorage();
    fetchDbSize();
    fetchGcsStorage();
    fetchDriveStorage();
  }, [fetchLovableStorage, fetchDbSize, fetchGcsStorage, fetchDriveStorage]);

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
  const totalFiles = bucketUsages.reduce((sum, b) => sum + b.fileCount, 0);
  const isLoading = lovableLoading || dbLoading || gcsLoading || driveLoading;

  const tableLabels: Record<string, string> = {
    profiles: '사용자 프로필', saved_quotes: '저장된 견적서', recipients: '거래처',
    projects: '프로젝트', attendance_records: '근태 기록', leave_requests: '휴가 신청',
    announcements: '공지사항', direct_messages: '메시지', material_orders: '원판 발주',
    employment_contracts: '근로 계약', performance_reviews: '업무 평가',
    incident_reports: '사건 보고서', project_updates: '프로젝트 업데이트',
    notifications: '알림', activity_logs: '활동 로그', quote_memos: '견적 메모',
    project_assignments: '프로젝트 배정', peer_feedback: '피드백',
    performance_review_scores: '평가 점수', performance_review_cycles: '평가 주기',
    performance_review_categories: '평가 카테고리', performance_review_summaries: '평가 요약',
    review_cycle_targets: '평가 대상자', processing_options: '가공 옵션',
    processing_categories: '가공 카테고리', panel_masters: '판넬 마스터',
    panel_sizes: '판넬 사이즈', color_options: '색상 옵션',
    color_mixing_costs: '조색 비용', panel_option_surcharges: '판재 옵션 추가금',
    company_holidays: '회사 휴일', company_info: '회사 정보',
    contract_templates: '계약서 템플릿', custom_leave_types: '휴가 유형',
    document_categories: '문서 카테고리', employee_documents: '직원 문서',
    leave_policy_settings: '휴가 정책', leave_general_settings: '휴가 일반 설정',
    labor_law_settings: '노동법 설정', page_access_permissions: '페이지 접근 권한',
    page_role_access: '역할별 접근', password_reset_requests: '비밀번호 초기화',
    slot_types: '슬롯 유형', category_logic_slots: '카테고리 로직',
    advanced_processing_settings: '고급 가공 설정', tax_deduction_items: '세금 공제',
    tax_dependents: '부양가족', year_end_tax_settlements: '연말정산',
    user_roles: '사용자 역할',
  };

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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
                    / 1GB · 파일 {totalFiles}개
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
                    {tableSizes.length}개 테이블
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
                    파일 {gcsFiles.length}개
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Google Drive</span>
              </div>
              {driveLoading ? (
                <div className="text-sm text-muted-foreground">조회 중...</div>
              ) : (
                <>
                  <p className="text-lg font-bold">{formatBytes(driveTotalSize)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    파일 {driveTotalFiles}개
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 데이터 저장 위치 안내 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              데이터 저장 위치 안내
            </CardTitle>
            <CardDescription>각 데이터가 어디에 저장되는지 확인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { data: '견적서 첨부 / PDF', locations: ['Lovable Cloud'], badges: ['quote-attachments', 'quote-pdfs'] },
                { data: '프로젝트 업데이트 첨부파일', locations: ['Lovable Cloud', 'GCS', 'Google Drive'], badges: ['project-update-attachments', '프로젝트업데이트'] },
                { data: '내부 프로젝트 증빙 (견적서/영수증)', locations: ['GCS', 'Google Drive'], badges: ['프로젝트명 > 문서유형 > 년 > 월'] },
                { data: '직원 문서 / 프로필 사진', locations: ['Lovable Cloud'], badges: ['employee-documents', 'avatars'] },
                { data: '팀 채팅 첨부파일', locations: ['GCS'], badges: ['team-chat/'] },
                { data: '거래처 사업자등록증', locations: ['GCS'], badges: ['recipient-documents/'] },
                { data: '연말정산 문서', locations: ['GCS'], badges: ['tax-documents/'] },
                { data: '사건 보고서 첨부', locations: ['GCS'], badges: ['incident-attachments/'] },
                { data: '모든 업무 데이터 (레코드)', locations: ['Database'], badges: ['profiles', 'projects', '...'] },
              ].map((item) => (
                <div key={item.data} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.data}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.locations.map((loc) => (
                        <Badge key={loc} variant="secondary" className="text-[10px] h-5">
                          {loc === 'Lovable Cloud' && <Cloud className="w-3 h-3 mr-1" />}
                          {loc === 'Database' && <Database className="w-3 h-3 mr-1" />}
                          {loc === 'GCS' && <Server className="w-3 h-3 mr-1" />}
                          {loc === 'Google Drive' && <FolderOpen className="w-3 h-3 mr-1" />}
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.badges.map((b) => (
                      <span key={b} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{b}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="lovable" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="lovable" className="text-xs">Lovable Cloud</TabsTrigger>
            <TabsTrigger value="database" className="text-xs">Database</TabsTrigger>
            <TabsTrigger value="gcs" className="text-xs">GCS</TabsTrigger>
            <TabsTrigger value="drive" className="text-xs">Google Drive</TabsTrigger>
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
                <CardDescription>테이블별 레코드 수 (총 {dbSize})</CardDescription>
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

          <TabsContent value="drive">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Google Drive 공유 드라이브</CardTitle>
                <CardDescription>프로젝트별 폴더 사용량</CardDescription>
              </CardHeader>
              <CardContent>
                {driveLoading ? (
                  <div className="text-sm text-muted-foreground">조회 중...</div>
                ) : driveFolders.length === 0 ? (
                  <div className="text-sm text-muted-foreground">폴더가 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {driveFolders.map((folder) => (
                      <div key={folder.name} className="flex items-center gap-3 p-3 rounded-lg border">
                        <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground">파일 {folder.fileCount}개</p>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground shrink-0">
                          {formatBytes(folder.totalSize)}
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
