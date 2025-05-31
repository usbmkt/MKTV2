import React, { useEffect } from 'react';
import { useMCPStore } from '@/lib/mcpStore';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import { useLocation } from 'wouter';

// Ícone customizado para o MCP Agent (SVG simples como exemplo)
const MCPIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
    aria-hidden="true"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
      fill="currentColor"
    />
    <path
      d="M12 6C9.24 6 7 8.24 7 11C7 12.76 7.79 14.29 9 15.19V18L12 16.5L15 18V15.19C16.21 14.29 17 12.76 17 11C17 8.24 14.76 6 12 6ZM12 14.5C11.17 14.5 10.5 13.83 10.5 13C10.5 12.17 11.17 11.5 12 11.5C12.83 11.5 13.5 12.17 13.5 13C13.5 13.83 12.83 14.5 12 14.5Z"
      fill="currentColor"
    />
  </svg>
);


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
          "bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white",
          isPanelOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100"
        )}
        aria-label="Abrir Agente MCP"
      >
        <MCPIcon />
      </Button>
      <ChatPanel />
    </>
  );
};
