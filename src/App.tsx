import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QuoteProvider } from "@/contexts/QuoteContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Calculator from "./pages/Calculator";
import NotFound from "./pages/NotFound";
import QuotePage from "./pages/QuotePage";
import CustomerQuotePage from "./pages/CustomerQuotePage";
import QuotesSummaryPage from "./pages/QuotesSummaryPage";
import CustomerQuotesSummaryPage from "./pages/CustomerQuotesSummaryPage";
import InternalQuotePage from "./pages/InternalQuotePage";
import EmbedCodePage from "./pages/EmbedCodePage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import PriceManagement from "./pages/PriceManagement";
import PanelManagementPage from "./pages/PanelManagementPage";
import ProcessingPriceManagement from "./pages/ProcessingPriceManagement";
import SavedQuotesPage from "./pages/SavedQuotesPage";
import SavedQuoteDetailPage from "./pages/SavedQuoteDetailPage";
import AuthPage from "./pages/AuthPage";
import MyPage from "./pages/MyPage";

import UserStatisticsPage from "./pages/UserStatisticsPage";
import PluuugIntegrationPage from "./pages/PluuugIntegrationPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import RecipientManagementPage from "./pages/RecipientManagementPage";
import AttendancePage from "./pages/AttendancePage";
import EmployeeProfileManagementPage from "./pages/EmployeeProfileManagementPage";
import LeaveManagementPage from "./pages/LeaveManagementPage";
import TeamChatPage from "./pages/TeamChatPage";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import ProjectManagementPage from "./pages/ProjectManagementPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <QuoteProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/quote" element={<QuotePage />} />
            <Route path="/customer-quote" element={<CustomerQuotePage />} />
            <Route path="/quotes-summary" element={<QuotesSummaryPage />} />
            <Route path="/customer-quotes-summary" element={<CustomerQuotesSummaryPage />} />
            <Route path="/internal-quote" element={<InternalQuotePage />} />
            <Route path="/embed-code" element={<EmbedCodePage />} />
            <Route path="/admin-settings" element={<AdminSettingsPage />} />
            <Route path="/price-management" element={<PriceManagement />} />
            <Route path="/panel-management" element={<PanelManagementPage />} />
            <Route path="/processing-price-management" element={<ProcessingPriceManagement />} />
            <Route path="/saved-quotes" element={<SavedQuotesPage />} />
            <Route path="/saved-quotes/:id" element={<SavedQuoteDetailPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/my-page" element={<MyPage />} />
            <Route path="/user-management" element={<Navigate to="/employee-profiles" replace />} />
            <Route path="/user-statistics" element={<UserStatisticsPage />} />
            <Route path="/pluuug-integration" element={<PluuugIntegrationPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/recipients" element={<RecipientManagementPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/employee-profiles" element={<EmployeeProfileManagementPage />} />
            <Route path="/leave-management" element={<LeaveManagementPage />} />
            <Route path="/team-chat" element={<TeamChatPage />} />
            <Route path="/company-settings" element={<CompanySettingsPage />} />
            <Route path="/project-management" element={<ProjectManagementPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </QuoteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
