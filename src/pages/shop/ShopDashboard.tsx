import { useState } from 'react';
import { useShopData } from '@/hooks/useShopData';
import { ShopStopCard } from '@/components/shop/ShopStopCard';
import { ShopStopDetailDialog } from '@/components/shop/ShopStopDetailDialog';
import { CreateShopStopDialog } from '@/components/shop/CreateShopStopDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { Plus, Package, Truck, CheckCircle, TrendingUp, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function ShopDashboard() {
  const { profile } = useAuth();
  const {
    activeStops, deliveredToday, fetchData,
    pendingCount, assignedCount, pickedCount, deliveredCount,
  } = useShopData();

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const stats = [
    { label: 'Pendientes', value: pendingCount, icon: Package, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Asignados', value: assignedCount, icon: UserCheck, color: 'text-status-assigned', bg: 'bg-[hsl(var(--status-assigned-bg))]' },
    { label: 'En camino', value: pickedCount, icon: Truck, color: 'text-status-picked', bg: 'bg-[hsl(var(--status-picked-bg))]' },
    { label: 'Entregados', value: deliveredCount, icon: CheckCircle, color: 'text-status-delivered', bg: 'bg-[hsl(var(--status-delivered-bg))]' },
  ];

  const handleClick = (stop: Stop) => {
    setSelectedStop(stop);
    setDetailOpen(true);
  };

  if (!activeStops && !deliveredToday) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">
            {profile?.shop_name ? `¡Hola, ${profile.shop_name}!` : 'Mi Panel'}
          </h1>
          <p className="text-muted-foreground text-sm hidden sm:block">Estado de tus pedidos en tiempo real</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Nuevo pedido</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card>
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Active stops */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pedidos activos</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {activeStops.map((stop) => (
            <ShopStopCard key={stop.id} stop={stop} onClick={() => handleClick(stop)} />
          ))}
          {activeStops.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No tienes pedidos activos</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Crear pedido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today delivered */}
      {deliveredToday.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              Entregados hoy
              <Button variant="ghost" size="sm" onClick={() => navigate('/shop/history')}>
                Ver historial completo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {deliveredToday.map((stop) => (
              <ShopStopCard key={stop.id} stop={stop} onClick={() => handleClick(stop)} />
            ))}
          </CardContent>
        </Card>
      )}

      <CreateShopStopDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchData} />
      <ShopStopDetailDialog stop={selectedStop} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
