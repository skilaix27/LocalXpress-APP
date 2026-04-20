import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ShopSidebar } from '@/components/shop/ShopSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, X } from 'lucide-react';

export default function ShopLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isMobile) {
    return (
      <div className="flex h-screen overflow-hidden">
        <ShopSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <header className="bg-secondary text-secondary-foreground px-4 py-3 flex items-center justify-between z-30 shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="p-1">
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm">LocalXpress · Mi Tienda</span>
        <div className="w-6" />
      </header>

      <main className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 animate-in slide-in-from-left">
            <div className="relative h-full">
              <ShopSidebar onNavigate={() => setSidebarOpen(false)} />
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-1 text-sidebar-foreground/80 hover:text-sidebar-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
