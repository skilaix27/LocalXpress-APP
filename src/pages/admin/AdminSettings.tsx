import { useState, useMemo } from 'react';
import { usePricingZones } from '@/hooks/usePricingZones';
import { useAdminData } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, Plus, Trash2, Save, MapPin, Euro, Users, Package, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice, calculatePrice } from '@/lib/pricing';
import type { PricingZone } from '@/lib/pricing';

export default function AdminSettings() {
  const { zones, loading, updateZone, addZone, deleteZone } = usePricingZones();
  const { allStops, allUsers, fetchData } = useAdminData();
  const [editingZones, setEditingZones] = useState<Record<string, Partial<PricingZone>>>({});
  const [newZone, setNewZone] = useState<Partial<PricingZone> | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const stats = useMemo(() => {
    const totalOrders = allStops.length;
    const totalRevenue = allStops.reduce((s, st) => s + (Number(st.price) || 0), 0);
    const ordersWithPrice = allStops.filter(s => s.price != null).length;
    const ordersWithoutPrice = allStops.filter(s => s.price == null && s.distance_km != null).length;
    return { totalOrders, totalRevenue, ordersWithPrice, ordersWithoutPrice };
  }, [allStops]);

  const getEditValue = (zone: PricingZone, field: keyof PricingZone) => editingZones[zone.id]?.[field] ?? zone[field];
  const setEditValue = (zoneId: string, field: keyof PricingZone, value: any) => {
    setEditingZones(prev => ({ ...prev, [zoneId]: { ...prev[zoneId], [field]: value } }));
  };

  const handleSave = async (zone: PricingZone) => {
    const edits = editingZones[zone.id];
    if (!edits) return;
    const success = await updateZone(zone.id, edits);
    if (success) setEditingZones(prev => { const next = { ...prev }; delete next[zone.id]; return next; });
  };

  const handleAddZone = async () => {
    if (!newZone?.name) return;
    await addZone({ name: newZone.name, min_km: newZone.min_km || 0, max_km: newZone.max_km || null, fixed_price: newZone.fixed_price || null, per_km_price: newZone.per_km_price || null, sort_order: zones.length + 1 } as any);
    setNewZone(null);
  };

  const recalculateAllPrices = async () => {
    const stopsToUpdate = allStops.filter(s => s.distance_km != null);
    if (stopsToUpdate.length === 0) { toast.info('No hay pedidos con distancia para recalcular'); return; }
    setRecalculating(true);
    try {
      let updated = 0;
      for (const stop of stopsToUpdate) {
        const { price, priceDriver, priceCompany } = await calculatePrice(stop.distance_km!);
        const { error } = await supabase.from('stops').update({
          price, price_driver: priceDriver, price_company: priceCompany,
        } as any).eq('id', stop.id);
        if (!error) updated++;
      }
      toast.success(`${updated} pedidos recalculados`);
      fetchData();
    } catch (err: any) {
      toast.error('Error al recalcular', { description: err.message });
    } finally { setRecalculating(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestión avanzada de la plataforma</p>
      </div>

      <Tabs defaultValue="pricing">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pricing" className="flex-1 sm:flex-none">Tarificación</TabsTrigger>
          <TabsTrigger value="operations" className="flex-1 sm:flex-none">Operaciones</TabsTrigger>
          <TabsTrigger value="stats" className="flex-1 sm:flex-none">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Zonas de tarificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Comisión automática: 70% repartidor / 30% empresa.</p>
              <div className="space-y-3">
                {zones.map((zone) => (
                  <div key={zone.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 rounded-lg border bg-muted/30">
                    <div className="sm:col-span-1">
                      <Label className="text-xs">Nombre</Label>
                      <Input value={getEditValue(zone, 'name') as string} onChange={(e) => setEditValue(zone.id, 'name', e.target.value)} className="text-sm" />
                    </div>
                    <div><Label className="text-xs">Desde (km)</Label><Input type="number" step="0.1" value={getEditValue(zone, 'min_km') as number} onChange={(e) => setEditValue(zone.id, 'min_km', parseFloat(e.target.value) || 0)} className="text-sm" /></div>
                    <div><Label className="text-xs">Hasta (km)</Label><Input type="number" step="0.1" value={(getEditValue(zone, 'max_km') as number) ?? ''} onChange={(e) => setEditValue(zone.id, 'max_km', e.target.value ? parseFloat(e.target.value) : null)} placeholder="∞" className="text-sm" /></div>
                    <div><Label className="text-xs">Precio fijo (€)</Label><Input type="number" step="0.01" value={(getEditValue(zone, 'fixed_price') as number) ?? ''} onChange={(e) => setEditValue(zone.id, 'fixed_price', e.target.value ? parseFloat(e.target.value) : null)} className="text-sm" /></div>
                    <div><Label className="text-xs">€/km extra</Label><Input type="number" step="0.01" value={(getEditValue(zone, 'per_km_price') as number) ?? ''} onChange={(e) => setEditValue(zone.id, 'per_km_price', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Solo zona abierta" className="text-sm" /></div>
                    <div className="flex gap-1">
                      {editingZones[zone.id] && <Button size="sm" onClick={() => handleSave(zone)} className="flex-1"><Save className="w-3 h-3 mr-1" /> Guardar</Button>}
                      <Button size="sm" variant="destructive" onClick={() => deleteZone(zone.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
              {newZone ? (
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="sm:col-span-1"><Label className="text-xs">Nombre</Label><Input value={newZone.name || ''} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} className="text-sm" /></div>
                  <div><Label className="text-xs">Desde (km)</Label><Input type="number" step="0.1" value={newZone.min_km || ''} onChange={(e) => setNewZone({ ...newZone, min_km: parseFloat(e.target.value) || 0 })} className="text-sm" /></div>
                  <div><Label className="text-xs">Hasta (km)</Label><Input type="number" step="0.1" value={newZone.max_km ?? ''} onChange={(e) => setNewZone({ ...newZone, max_km: e.target.value ? parseFloat(e.target.value) : null })} placeholder="∞" className="text-sm" /></div>
                  <div><Label className="text-xs">Precio fijo (€)</Label><Input type="number" step="0.01" value={newZone.fixed_price ?? ''} onChange={(e) => setNewZone({ ...newZone, fixed_price: e.target.value ? parseFloat(e.target.value) : null })} className="text-sm" /></div>
                  <div><Label className="text-xs">€/km extra</Label><Input type="number" step="0.01" value={newZone.per_km_price ?? ''} onChange={(e) => setNewZone({ ...newZone, per_km_price: e.target.value ? parseFloat(e.target.value) : null })} className="text-sm" /></div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleAddZone} disabled={!newZone.name} className="flex-1"><Save className="w-3 h-3 mr-1" /> Crear</Button>
                    <Button size="sm" variant="outline" onClick={() => setNewZone(null)}>✕</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setNewZone({ name: '', min_km: 0, max_km: null, fixed_price: null, per_km_price: null, sort_order: zones.length + 1 })}>
                  <Plus className="w-4 h-4 mr-2" /> Añadir zona
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" /> Recalcular precios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Recalcula los precios de todos los pedidos según las zonas actuales. Útil tras modificar las tarifas.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={recalculateAllPrices} disabled={recalculating}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                  {recalculating ? 'Recalculando...' : `Recalcular ${stats.ordersWithoutPrice > 0 ? `(${stats.ordersWithoutPrice} sin precio)` : 'todos'}`}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Euro className="w-5 h-5 text-primary" /> Comisiones</CardTitle></CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm"><span>Repartidor</span><span className="font-bold">70%</span></div>
                <div className="flex justify-between text-sm"><span>Empresa</span><span className="font-bold">30%</span></div>
                <p className="text-xs text-muted-foreground mt-2">La comisión se aplica automáticamente a cada pedido.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center">
              <Package className="w-6 h-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Total pedidos</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Euro className="w-6 h-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{formatPrice(stats.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Facturación</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{allUsers.filter(u => u.role === 'driver').length}</p>
              <p className="text-xs text-muted-foreground">Repartidores</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{allUsers.filter(u => u.role === 'shop').length}</p>
              <p className="text-xs text-muted-foreground">Tiendas</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Distribución por zona</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {zones.map(zone => {
                  const zoneStops = allStops.filter(s => {
                    if (s.distance_km == null) return false;
                    const d = s.distance_km + 0.15;
                    const max = zone.max_km ?? Infinity;
                    return d >= zone.min_km && d < max;
                  });
                  const revenue = zoneStops.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                  return (
                    <div key={zone.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-medium text-sm">{zone.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{zone.min_km}-{zone.max_km ?? '∞'} km</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold">{zoneStops.length} pedidos</span>
                        <span className="text-xs text-primary font-semibold ml-2">{formatPrice(revenue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
