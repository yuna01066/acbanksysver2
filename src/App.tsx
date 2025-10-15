import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QuoteProvider } from "@/contexts/QuoteContext";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </QuoteProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
