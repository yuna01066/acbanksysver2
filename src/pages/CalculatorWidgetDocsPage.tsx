import React, { useMemo, useState } from 'react';
import HomeLogoButton from "@/components/HomeLogoButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, AlertTriangle, Settings2, MousePointerClick, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CodeBlock: React.FC<{ title: string; code: string; height?: string }> = ({ title, code, height = "h-64" }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "복사 완료", description: `${title} 코드가 복사되었습니다.` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "복사 실패", description: "코드를 직접 선택해서 복사해주세요.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" className="h-8 gap-2" onClick={copy}>
          <Copy className="h-3 w-3" />
          {copied ? '복사됨!' : '코드 복사'}
        </Button>
      </div>
      <Textarea
        readOnly
        value={code}
        className={`font-mono text-xs resize-none ${height}`}
        onClick={(e) => e.currentTarget.select()}
      />
    </div>
  );
};

const CalculatorWidgetDocsPage = () => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://acbanksysver2.lovable.app';
  const calcUrl = `${origin}/calculator?type=quote&embed=1`;

  const modalButtonCode = useMemo(() => `<!-- 아크뱅크 판재 단가 계산기 : 버튼형 위젯 (모달) -->
<button type="button" id="acbank-calc-btn"
  style="display:inline-flex;align-items:center;gap:8px;padding:14px 22px;border:0;border-radius:10px;
         background:#111827;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">
  판재 단가 계산하기
</button>

<div id="acbank-calc-modal"
  style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);padding:16px;">
  <div style="position:relative;max-width:1200px;height:100%;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <button type="button" id="acbank-calc-close"
      style="position:absolute;top:10px;right:12px;z-index:2;border:0;background:#f3f4f6;border-radius:8px;
             padding:6px 12px;font-size:14px;cursor:pointer;">닫기</button>
    <iframe id="acbank-calc-frame" src="" title="판재 단가 계산기"
      width="100%" height="100%" frameborder="0" scrolling="yes" loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
</div>

<script>
(function () {
  var SRC = "${calcUrl}";
  var btn = document.getElementById('acbank-calc-btn');
  var modal = document.getElementById('acbank-calc-modal');
  var frame = document.getElementById('acbank-calc-frame');
  btn.addEventListener('click', function () {
    if (!frame.getAttribute('src')) frame.setAttribute('src', SRC);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  });
  function close() { modal.style.display = 'none'; document.body.style.overflow = ''; }
  document.getElementById('acbank-calc-close').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
</script>`, [calcUrl]);

  const newTabButtonCode = useMemo(() => `<!-- 판재 단가 계산기 : 새 창(탭)으로 열리는 버튼 -->
<a href="${calcUrl}" target="_blank" rel="noopener noreferrer"
  style="display:inline-flex;align-items:center;gap:8px;padding:14px 22px;border-radius:10px;
         background:#111827;color:#fff;text-decoration:none;font-size:15px;font-weight:600;">
  판재 단가 계산기 열기
</a>`, [calcUrl]);

  const inlineToggleCode = useMemo(() => `<!-- 판재 단가 계산기 : 버튼 클릭 시 같은 페이지에서 펼쳐지는 방식 -->
<button type="button" onclick="
  var w=document.getElementById('acbank-calc-inline');
  var f=document.getElementById('acbank-calc-inline-frame');
  if(!f.src){f.src='${calcUrl}';}
  w.style.display = (w.style.display==='none'||!w.style.display) ? 'block' : 'none';"
  style="padding:14px 22px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:600;cursor:pointer;">
  판재 단가 계산기 열기 / 닫기
</button>

<div id="acbank-calc-inline" style="display:none;margin-top:16px;">
  <iframe id="acbank-calc-inline-frame" src="" title="판재 단가 계산기"
    width="100%" height="1000" frameborder="0" scrolling="yes" loading="lazy"
    style="border:1px solid #e5e7eb;border-radius:8px;"></iframe>
</div>`, [calcUrl]);

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <HomeLogoButton />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MousePointerClick className="h-5 w-5" />
              버튼형 판재 단가 계산기 위젯 사용 방법
            </CardTitle>
            <p className="text-sm text-gray-600">
              홈페이지(아임웹 등)에 버튼 하나만 노출하고, 방문자가 클릭할 때 판재 단가 계산기를 띄우는 방식입니다.
              페이지 로딩 속도에 영향을 최소화할 수 있어 상품 상세·랜딩 페이지에 적합합니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="font-medium">설치 순서</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-gray-600">
                <li>홈페이지 관리자에 로그인 후 버튼을 넣을 페이지를 편집합니다.</li>
                <li>“HTML / 코드 삽입” 블록을 추가합니다.</li>
                <li>아래 3가지 방식 중 하나의 코드를 붙여넣습니다.</li>
                <li>저장 후 실제 페이지(관리자 미리보기 아님)에서 버튼 클릭 동작을 확인합니다.</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500">현재 위젯 주소: <code className="rounded bg-gray-100 px-1 py-0.5">{calcUrl}</code></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">임베드 예시</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <CodeBlock title="1) 모달(팝업) 방식 – 권장" code={modalButtonCode} height="h-72" />
            <CodeBlock title="2) 새 창(탭) 방식 – 가장 단순" code={newTabButtonCode} height="h-32" />
            <CodeBlock title="3) 인라인 펼침 방식" code={inlineToggleCode} height="h-56" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4" />
              설정 값
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-2">항목</th>
                    <th className="p-2">값 / 예시</th>
                    <th className="p-2">설명</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="p-2 font-medium">기본 주소</td>
                    <td className="p-2"><code>/calculator</code></td>
                    <td className="p-2">판재 단가 계산기 페이지</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">type</td>
                    <td className="p-2"><code>quote</code></td>
                    <td className="p-2">견적용 계산 모드로 진입</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">embed</td>
                    <td className="p-2"><code>1</code></td>
                    <td className="p-2">외부 임베드 표시임을 알리는 플래그</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">iframe 높이</td>
                    <td className="p-2">PC 1000px / 모바일 800px</td>
                    <td className="p-2">인라인 방식일 때 권장 값</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">최대 폭</td>
                    <td className="p-2">1200~1400px</td>
                    <td className="p-2">표 형태 입력 영역이 잘리지 않는 폭</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">loading</td>
                    <td className="p-2"><code>lazy</code></td>
                    <td className="p-2">첫 로딩 속도 확보</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">referrerpolicy</td>
                    <td className="p-2"><code>strict-origin-when-cross-origin</code></td>
                    <td className="p-2">유입 경로 확인 + 보안 균형</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              주의사항
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-gray-700">
              <li>단가는 서버의 최신 판재 단가표를 기준으로 계산됩니다. 단가 정책이 바뀌면 위젯 결과도 즉시 바뀝니다.</li>
              <li>계산 결과는 참고용 개산 금액입니다. 최종 금액·세액은 정식 견적서(100원 단위 반올림 규칙 적용) 기준으로 안내하세요.</li>
              <li>일부 홈페이지 빌더는 <code>&lt;script&gt;</code> 사용을 제한합니다. 이 경우 2) 새 창 방식을 사용하세요.</li>
              <li>모달 방식은 페이지에 <code>id</code>가 중복되면 동작하지 않습니다. 한 페이지에 하나만 삽입하세요.</li>
              <li>iframe 내부 높이를 자동으로 늘릴 수 없으므로, 인라인 방식은 반드시 고정 높이 + 내부 스크롤을 유지하세요.</li>
              <li>모바일에서는 좌우 스크롤이 생길 수 있어 모달/새 창 방식을 권장합니다.</li>
              <li>HTTPS 페이지에만 삽입하세요. HTTP 페이지에서는 브라우저가 iframe을 차단할 수 있습니다.</li>
              <li>고객 문의 접수까지 필요하면 상담폼 위젯을 함께 배치하세요(관리자 &gt; 임베드 코드).</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" />
              설치 후 점검 체크리스트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-gray-700">
              <li>버튼 클릭 시 계산기가 정상적으로 열리는지 (PC/모바일 각각)</li>
              <li>닫기 버튼, 배경 클릭, ESC 키로 닫히는지</li>
              <li>사이즈·옵션 변경 시 금액이 갱신되는지</li>
              <li>페이지 첫 진입 속도가 느려지지 않았는지</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalculatorWidgetDocsPage;
