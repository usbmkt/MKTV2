// client/src/components/mcp/FloatingMCPAgent.tsx
import React, { useEffect } from 'react';
import { useMCPStore } from '@/lib/mcpStore';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import { useLocation } from 'wouter';
import UbiePng from '@/img/ubie.png'; // Importando ubie.png

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
          "bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white p-0 overflow-hidden", // Adicionado p-0 e overflow-hidden
          isPanelOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100"
        )}
        aria-label="Abrir Agente Ubie" // Alterado para Agente Ubie
      >
        <img src={UbiePng} alt="Agente Ubie" className="h-full w-full object-cover rounded-full" /> {/* Imagem preenche o botão */}
      </Button>
      <ChatPanel />
    </>
  );
};
