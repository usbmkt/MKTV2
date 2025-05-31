// client/src/components/sidebar.tsx
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query'; // Importar useQuery
import { apiRequest } from '@/lib/api'; // Importar apiRequest
import {
  LayoutDashboard,
  Megaphone,
  Image as ImageIcon,
  DollarSign,
  Filter,
  PenTool,
  TrendingUp,
  Bell,
  MessageCircle,
  Download,
  LogOut,
  Rocket,
  Globe,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { path: '/creatives', label: 'Criativos', icon: ImageIcon },
  { path: '/budget', label: 'Orçamento', icon: DollarSign },
  { path: '/landingpages', label: 'Landing Pages', icon: Globe },
  { path: '/funnel', label: 'Funil', icon: Filter },
  { path: '/copy', label: 'Copy & IA', icon: PenTool },
  { path: '/metrics', label: 'Métricas', icon: TrendingUp },
  { path: '/alerts', label: 'Alertas', icon: Bell },
  { path: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { path: '/integrations', label: 'Integrações', icon: Rocket },
  { path: '/export', label: 'Exportar', icon: Download },
];

interface DashboardData {
  metrics: any;
  recentCampaigns: any[];
  alertCount: number;
}

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Query para buscar dados do dashboard, incluindo alertCount
  const { data: dashboardData } = useQuery<DashboardData>({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      if (!user) return { metrics: {}, recentCampaigns: [], alertCount: 0 }; // Não busca se não houver usuário
      const response = await apiRequest('GET', '/api/dashboard');
      if (!response.ok) {
        console.error('Erro ao buscar dados do dashboard para a sidebar');
        return { metrics: {}, recentCampaigns: [], alertCount: 0 }; // Retorna um valor padrão em caso de erro
      }
      return response.json();
    },
    enabled: !!user, // A query só é habilitada se houver um usuário logado
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const alertCount = dashboardData?.alertCount || 0;

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const getUserInitials = (username: string | undefined) => {
    if (!username) return 'U';
    return username
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside 
      className={cn(
        "neu-sidebar flex flex-col h-full",
        isCollapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className={cn(
          "p-4 flex items-center border-b border-sidebar-border shrink-0", 
          isCollapsed ? "justify-center h-[72px]" : "justify-start h-[72px]"
        )}
      >
        <Link href="/dashboard" className={cn("flex items-center gap-2 group", isCollapsed ? "" : "neu-card p-2")}>
            <Rocket 
              className={cn(
                "text-primary transition-all duration-300 ease-in-out group-hover:icon-neon-glow", // Adicionado group-hover
                isCollapsed ? "w-7 h-7" : "w-6 h-6 animate-glow" 
              )} 
            />
            {!isCollapsed && (
              <h1 className="text-base font-bold text-foreground gradient-primary bg-clip-text text-transparent group-hover:text-neon-glow"> {/* Adicionado group-hover */}
                USB MKT
              </h1>
            )}
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (location === '/' && item.path === '/dashboard');
          return (
            <Link key={item.path} href={item.path} title={isCollapsed ? item.label : undefined}>
              <div 
                className={cn(
                  "sidebar-link group",
                  isActive && "active",
                  isCollapsed ? "justify-center aspect-square p-0" : "px-3 py-2.5 space-x-2.5"
                )}
              >
                <Icon className={cn(
                    "sidebar-link-icon w-[18px] h-[18px] shrink-0",
                     isActive ? "text-sidebar-accent-foreground icon-neon-glow" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground group-hover:icon-neon-glow"
                    )} 
                />
                {!isCollapsed && (
                  <span className={cn("sidebar-link-text text-xs font-medium truncate", isActive && "text-neon-glow")}>{item.label}</span>
                )}
                {!isCollapsed && item.path === '/alerts' && user && alertCount > 0 && (
                  <span className="alert-badge">{alertCount > 9 ? '9+' : alertCount}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className={cn(
          "px-2.5 py-3 border-t border-sidebar-border mt-auto shrink-0", 
          isCollapsed ? "space-y-2" : "flex items-center justify-between gap-2"
        )}
      >
        <div className={cn(isCollapsed ? "w-full flex justify-center" : "")}>
            <ThemeToggle />
        </div>
        <Button
            variant="ghost"
            onClick={toggleSidebar}
            className={cn(
                "theme-toggle-button text-muted-foreground hover:text-foreground",
                isCollapsed ? "w-full" : "p-2" 
            )}
            title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && user && ( // Mostrar perfil apenas se logado e não colapsado
        <div className="p-2.5 border-t border-sidebar-border shrink-0">
          <div className="neu-card p-2.5">
            <div className="flex items-center space-x-2">
              <Avatar className="w-9 h-9 neu-card-inset p-0.5">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {getUserInitials(user?.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {user?.username}
                </p>
                <p className="text-[0.7rem] text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="theme-toggle-button p-1.5 text-muted-foreground hover:text-destructive"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
