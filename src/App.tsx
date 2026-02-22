import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QuoteProvider } from "@/contexts/QuoteContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import PageAccessGuard from "@/components/PageAccessGuard";

// 즉시 로드 (항상 필요)
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";

// Lazy 로드 (필요할 때만)
const Calculator = lazy(() => import("./pages/Calculator"));
const QuotePage = lazy(() => import("./pages/QuotePage"));
const CustomerQuotePage = lazy(() => import("./pages/CustomerQuotePage"));
const QuotesSummaryPage = lazy(() => import("./pages/QuotesSummaryPage"));
const CustomerQuotesSummaryPage = lazy(() => import("./pages/CustomerQuotesSummaryPage"));
const InternalQuotePage = lazy(() => import("./pages/InternalQuotePage"));
const EmbedCodePage = lazy(() => import("./pages/EmbedCodePage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const PriceManagement = lazy(() => import("./pages/PriceManagement"));
const PanelManagementPage = lazy(() => import("./pages/PanelManagementPage"));
const ProcessingPriceManagement = lazy(() => import("./pages/ProcessingPriceManagement"));
const SavedQuotesPage = lazy(() => import("./pages/SavedQuotesPage"));
const SavedQuoteDetailPage = lazy(() => import("./pages/SavedQuoteDetailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const MyPage = lazy(() => import("./pages/MyPage"));
const UserStatisticsPage = lazy(() => import("./pages/UserStatisticsPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const RecipientManagementPage = lazy(() => import("./pages/RecipientManagementPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const EmployeeProfileManagementPage = lazy(() => import("./pages/EmployeeProfileManagementPage"));
const EmployeeWorkManagementPage = lazy(() => import("./pages/EmployeeWorkManagementPage"));
const LeaveManagementPage = lazy(() => import("./pages/LeaveManagementPage"));
const TeamChatPage = lazy(() => import("./pages/TeamChatPage"));
const CompanySettingsPage = lazy(() => import("./pages/CompanySettingsPage"));
const ProjectManagementPage = lazy(() => import("./pages/ProjectManagementPage"));
const ReviewSettingsPage = lazy(() => import("./pages/ReviewSettingsPage"));
const PerformanceReviewPage = lazy(() => import("./pages/PerformanceReviewPage"));
const MaterialOrdersPage = lazy(() => import("./pages/MaterialOrdersPage"));
const YearEndTaxPage = lazy(() => import("./pages/YearEndTaxPage"));
const YearEndTaxAdminPage = lazy(() => import("./pages/YearEndTaxAdminPage"));
const StorageStatusPage = lazy(() => import("./pages/StorageStatusPage"));
const QuoteTemplateManagementPage = lazy(() => import("./pages/QuoteTemplateManagementPage"));
const TaxInvoicesPage = lazy(() => import("./pages/TaxInvoicesPage"));
const SampleChipInventoryPage = lazy(() => import("./pages/SampleChipInventoryPage"));
const ImwebManagementPage = lazy(() => import("./pages/ImwebManagementPage"));
const ExhibitionManagementPage = lazy(() => import("./pages/ExhibitionManagementPage"));
const BusinessDashboardPage = lazy(() => import("./pages/BusinessDashboardPage"));
const queryClient = new QueryClient();

const G: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PageAccessGuard>{children}</PageAccessGuard>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <QuoteProvider>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/calculator" element={<Calculator />} />
              <Route path="/quote" element={<QuotePage />} />
              <Route path="/customer-quote" element={<CustomerQuotePage />} />
              <Route path="/quotes-summary" element={<G><QuotesSummaryPage /></G>} />
              <Route path="/customer-quotes-summary" element={<G><CustomerQuotesSummaryPage /></G>} />
              <Route path="/internal-quote" element={<InternalQuotePage />} />
              <Route path="/embed-code" element={<EmbedCodePage />} />
              <Route path="/admin-settings" element={<AdminSettingsPage />} />
              <Route path="/price-management" element={<PriceManagement />} />
              <Route path="/panel-management" element={<PanelManagementPage />} />
              <Route path="/processing-price-management" element={<ProcessingPriceManagement />} />
              <Route path="/saved-quotes" element={<G><SavedQuotesPage /></G>} />
              <Route path="/saved-quotes/:id" element={<G><SavedQuoteDetailPage /></G>} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/my-page" element={<MyPage />} />
              <Route path="/user-management" element={<Navigate to="/employee-profiles" replace />} />
              <Route path="/user-statistics" element={<UserStatisticsPage />} />
              <Route path="/announcements" element={<G><AnnouncementsPage /></G>} />
              <Route path="/recipients" element={<G><RecipientManagementPage /></G>} />
              <Route path="/recipient-management" element={<Navigate to="/recipients" replace />} />
              <Route path="/attendance" element={<G><AttendancePage /></G>} />
              <Route path="/employee-profiles" element={<EmployeeProfileManagementPage />} />
              <Route path="/employee-work" element={<Navigate to="/employee-profiles" replace />} />
              <Route path="/leave-management" element={<G><LeaveManagementPage /></G>} />
              <Route path="/team-chat" element={<G><TeamChatPage /></G>} />
              <Route path="/company-settings" element={<CompanySettingsPage />} />
              <Route path="/project-management" element={<G><ProjectManagementPage /></G>} />
              <Route path="/review-settings" element={<ReviewSettingsPage />} />
              <Route path="/performance-review" element={<G><PerformanceReviewPage /></G>} />
              <Route path="/material-orders" element={<G><MaterialOrdersPage /></G>} />
              <Route path="/year-end-tax" element={<YearEndTaxPage />} />
              <Route path="/year-end-tax-admin" element={<YearEndTaxAdminPage />} />
              <Route path="/storage-status" element={<StorageStatusPage />} />
              <Route path="/quote-template-management" element={<QuoteTemplateManagementPage />} />
              <Route path="/tax-invoices" element={<G><TaxInvoicesPage /></G>} />
              <Route path="/sample-chip-inventory" element={<SampleChipInventoryPage />} />
              <Route path="/imweb-management" element={<G><ImwebManagementPage /></G>} />
              <Route path="/exhibition-management" element={<G><ExhibitionManagementPage /></G>} />
              <Route path="/business-dashboard" element={<G><BusinessDashboardPage /></G>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </QuoteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
