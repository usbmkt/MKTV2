// client/src/components/mcp/FloatingMCPAgent.tsx
import React, { useEffect } from 'react';
import { useMCPStore } from '@/lib/mcpStore';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import { useLocation } from 'wouter';
// import { BotMessageSquare } from 'lucide-react'; // Alternativa se não tiver imagem

// Removido o componente MCPIcon SVG customizado

export const FloatingMCPAgent: React.FC = () => {
  const { isPanelOpen, togglePanel, setNavigateFunction } = useMCPStore();
  const { isAuthenticated } = useAuthStore();
  const [, navigateWouter] = useLocation();

  useEffect(() => {
    setNavigateFunction(navigateWouter);
  }, [setNavigateFunction, navigateWouter]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Button
        onClick={togglePanel}
        variant="default"
        size="icon"
        className={cn(
          "fixed bottom-5 right-5 z-[99] h-14 w-14 rounded-full shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110 focus:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white flex items-center justify-center p-0", // Adicionado p-0 e flex para centralizar img
          isPanelOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100"
        )}
        aria-label="Abrir Agente MCP"
      >
        {/* LOGO UBIE ADICIONADO AQUI */}
        <img 
            src="/ubie-logo.svg" // Coloque seu logo para "Ubie" em client/public/ubie-logo.svg (ou .png)
            alt="Ubie Agente MCP" 
            className="h-8 w-8 object-contain" // Ajuste o tamanho conforme necessário
        />
        {/* Alternativa com Lucide Icon: <BotMessageSquare className="h-7 w-7" /> */}
      </Button>
      <ChatPanel />
    </>
  );
};
