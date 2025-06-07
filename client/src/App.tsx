import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

import Layout from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Campaigns from "@/pages/campaigns";
import Creatives from "@/pages/creatives";
import Budget from "@/pages/budget";
import LandingPagesPage from "@/pages/landingpages";
import WhatsApp from "@/pages/whatsapp";
import Copy from "@/pages/copy";
import Funnel from "@/pages/funnel";
import Metrics from "@/pages/metrics";
import Alerts from "@/pages/alerts";
import Export from "@/pages/export";
import Integrations from "@/pages/integrations";
import NotFound from "@/pages/not-found";
import { useAuthStore } from "@/lib/auth";
import { useEffect } from "react";

import { FloatingMCPAgent } from "@/components/mcp/FloatingMCPAgent"; // <-- IMPORTAR O AGENTE

// Componente ProtectedRoute (SEU CÓDIGO ORIGINAL)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [, navigate] = useLocation();

  // Bypass para desenvolvimento - forçar autenticação
  const forceBypass = window.location.hostname.includes('all-hands.dev') || 
                     import.meta.env.VITE_FORCE_AUTH_BYPASS === 'true';

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!forceBypass && !isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate, forceBypass]);

  if (!forceBypass && isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!forceBypass && !isAuthenticated) {
    return null;
  }

  return <Layout>{children}</Layout>;
}

// Seu componente Router (SEU CÓDIGO ORIGINAL)
function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute><Campaigns /></ProtectedRoute>
      </Route>
      <Route path="/creatives">
        <ProtectedRoute><Creatives /></ProtectedRoute>
      </Route>
      <Route path="/budget">
        <ProtectedRoute><Budget /></ProtectedRoute>
      </Route>
      <Route path="/landingpages">
        <ProtectedRoute><LandingPagesPage /></ProtectedRoute>
      </Route>
      <Route path="/whatsapp">
        <ProtectedRoute><WhatsApp /></ProtectedRoute>
      </Route>
      <Route path="/copy">
        <ProtectedRoute><Copy /></ProtectedRoute>
      </Route>
      <Route path="/funnel">
        <ProtectedRoute><Funnel /></ProtectedRoute>
      </Route>
      <Route path="/metrics">
        <ProtectedRoute><Metrics /></ProtectedRoute>
      </Route>
      <Route path="/alerts">
        <ProtectedRoute><Alerts /></ProtectedRoute>
      </Route>
      <Route path="/export">
        <ProtectedRoute><Export /></ProtectedRoute>
      </Route>
      <Route path="/integrations">
        <ProtectedRoute><Integrations /></ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
          <FloatingMCPAgent /> {/* <-- ADICIONAR O AGENTE MCP AQUI */}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
