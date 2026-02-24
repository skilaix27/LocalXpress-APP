import { useState } from 'react';
import { CreateShopStopDialog } from '@/components/shop/CreateShopStopDialog';
import { useShopData } from '@/hooks/useShopData';
import { ShopStopCard } from '@/components/shop/ShopStopCard';
import { ShopStopDetailDialog } from '@/components/shop/ShopStopDetailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { Plus, Package } from 'lucide-react';

export default function ShopNewStop() {
  const { activeStops, fetchData } = useShopData();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" /> Nuevo pedido
          </h1>
          <p className="text-muted-foreground text-sm">Crea un nuevo pedido de entrega</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Crear pedido</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pedidos activos ({activeStops.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {activeStops.map((stop) => (
            <ShopStopCard key={stop.id} stop={stop} onClick={() => { setSelectedStop(stop); setDetailOpen(true); }} />
          ))}
          {activeStops.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No hay pedidos activos</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateShopStopDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={fetchData} />
      <ShopStopDetailDialog stop={selectedStop} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
