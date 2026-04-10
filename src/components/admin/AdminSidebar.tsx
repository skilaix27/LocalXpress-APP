import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MapPin,
  Users,
  Package,
  History,
  LogOut,
  Store,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoLocalxpress from '@/assets/logo-localxpress.png';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/stops', icon: Package, label: 'Paradas' },
  { to: '/admin/clients', icon: Store, label: 'Clientes' },
  { to: '/admin/users', icon: Users, label: 'Usuarios' },
  { to: '/admin/map', icon: MapPin, label: 'Mapa' },
  { to: '/admin/history', icon: History, label: 'Historial' },
  { to: '/admin/settings', icon: Settings, label: 'Configuración' },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { profile, signOut } = useAuth();

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoLocalxpress} alt="LocalXpress" className="h-9" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-card'
                  : 'text-sidebar-foreground/95 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-semibold">
              {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60">Administrador</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
