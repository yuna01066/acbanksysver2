import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, FileText, Briefcase, DollarSign, RefreshCw, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { usePluuugApi, PluuugClient, PluuugEstimate, PluuugContract, PluuugSettlement } from '@/hooks/usePluuugApi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const PluuugIntegrationPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const pluuugApi = usePluuugApi();
  
  const [clients, setClients] = useState<PluuugClient[]>([]);
  const [estimates, setEstimates] = useState<PluuugEstimate[]>([]);
  const [contracts, setContracts] = useState<PluuugContract[]>([]);
  const [settlements, setSettlements] = useState<PluuugSettlement[]>([]);
  const [activeTab, setActiveTab] = useState('clients');

  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('로그인이 필요합니다');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const loadClients = async () => {
    const result = await pluuugApi.getClients();
    if (result.data) {
      setClients(Array.isArray(result.data) ? result.data : []);
      toast.success('고객 목록을 불러왔습니다');
    }
  };

  const loadEstimates = async () => {
    const result = await pluuugApi.getEstimates();
    if (result.data) {
      setEstimates(Array.isArray(result.data) ? result.data : []);
      toast.success('견적서 목록을 불러왔습니다');
    }
  };

  const loadContracts = async () => {
    const result = await pluuugApi.getContracts();
    if (result.data) {
      setContracts(Array.isArray(result.data) ? result.data : []);
      toast.success('계약 목록을 불러왔습니다');
    }
  };

  const loadSettlements = async () => {
    const result = await pluuugApi.getSettlements();
    if (result.data) {
      setSettlements(Array.isArray(result.data) ? result.data : []);
      toast.success('정산 목록을 불러왔습니다');
    }
  };

  const handleRefresh = () => {
    switch (activeTab) {
      case 'clients':
        loadClients();
        break;
      case 'estimates':
        loadEstimates();
        break;
      case 'contracts':
        loadContracts();
        break;
      case 'settlements':
        loadSettlements();
        break;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              돌아가기
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Pluuug 연동</h1>
              <p className="text-gray-500 text-sm">플러그와 견적 데이터를 동기화합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={pluuugApi.loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${pluuugApi.loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://app.pluuug.com', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Pluuug 열기
            </Button>
          </div>
        </div>

        {/* 탭 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              고객
            </TabsTrigger>
            <TabsTrigger value="estimates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              견적서
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              계약
            </TabsTrigger>
            <TabsTrigger value="settlements" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              정산
            </TabsTrigger>
          </TabsList>

          {/* 고객 탭 */}
          <TabsContent value="clients">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pluuug 고객 목록</CardTitle>
                <Button onClick={loadClients} disabled={pluuugApi.loading}>
                  {pluuugApi.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  불러오기
                </Button>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>"불러오기" 버튼을 클릭하여 Pluuug 고객 데이터를 가져오세요</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clients.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                        <div>
                          <p className="font-medium">{client.companyName}</p>
                          <p className="text-sm text-gray-500">
                            {client.inCharge} {client.position ? `(${client.position})` : ''}
                          </p>
                          {client.email && <p className="text-sm text-gray-400">{client.email}</p>}
                        </div>
                        <Badge variant="secondary">{client.status?.title || '상태없음'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 견적서 탭 */}
          <TabsContent value="estimates">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pluuug 견적서 목록</CardTitle>
                <Button onClick={loadEstimates} disabled={pluuugApi.loading}>
                  {pluuugApi.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  불러오기
                </Button>
              </CardHeader>
              <CardContent>
                {estimates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>"불러오기" 버튼을 클릭하여 Pluuug 견적서를 가져오세요</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {estimates.map((estimate) => (
                      <div key={estimate.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                        <div>
                          <p className="font-medium">{estimate.title}</p>
                          {estimate.client && (
                            <p className="text-sm text-gray-500">{estimate.client.companyName}</p>
                          )}
                          {estimate.totalAmount && (
                            <p className="text-sm font-medium text-blue-600">
                              ₩{estimate.totalAmount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">{estimate.status?.title || '상태없음'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 계약 탭 */}
          <TabsContent value="contracts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pluuug 계약 목록</CardTitle>
                <Button onClick={loadContracts} disabled={pluuugApi.loading}>
                  {pluuugApi.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  불러오기
                </Button>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>"불러오기" 버튼을 클릭하여 Pluuug 계약을 가져오세요</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((contract) => (
                      <div key={contract.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                        <div>
                          <p className="font-medium">{contract.title}</p>
                          {contract.client && (
                            <p className="text-sm text-gray-500">{contract.client.companyName}</p>
                          )}
                          {contract.amount && (
                            <p className="text-sm font-medium text-green-600">
                              ₩{contract.amount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">{contract.category?.title || '분류없음'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 정산 탭 */}
          <TabsContent value="settlements">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pluuug 정산 목록</CardTitle>
                <Button onClick={loadSettlements} disabled={pluuugApi.loading}>
                  {pluuugApi.loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  불러오기
                </Button>
              </CardHeader>
              <CardContent>
                {settlements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>"불러오기" 버튼을 클릭하여 Pluuug 정산을 가져오세요</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settlements.map((settlement) => (
                      <div key={settlement.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                        <div>
                          <p className="font-medium">{settlement.title}</p>
                          {settlement.amount && (
                            <p className="text-sm font-medium text-purple-600">
                              ₩{settlement.amount.toLocaleString()}
                            </p>
                          )}
                          {settlement.settledAt && (
                            <p className="text-sm text-gray-400">
                              정산일: {new Date(settlement.settledAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary">{settlement.type?.title || '유형없음'}</Badge>
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

export default PluuugIntegrationPage;
