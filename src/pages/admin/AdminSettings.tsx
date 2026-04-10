import { useState } from 'react';
import { usePricingZones } from '@/hooks/usePricingZones';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Plus, Trash2, Save, MapPin } from 'lucide-react';
import type { PricingZone } from '@/lib/pricing';

export default function AdminSettings() {
  const { zones, loading, updateZone, addZone, deleteZone } = usePricingZones();
  const [editingZones, setEditingZones] = useState<Record<string, Partial<PricingZone>>>({});
  const [newZone, setNewZone] = useState<Partial<PricingZone> | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getEditValue = (zone: PricingZone, field: keyof PricingZone) => {
    return editingZones[zone.id]?.[field] ?? zone[field];
  };

  const setEditValue = (zoneId: string, field: keyof PricingZone, value: any) => {
    setEditingZones(prev => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], [field]: value },
    }));
  };

  const handleSave = async (zone: PricingZone) => {
    const edits = editingZones[zone.id];
    if (!edits) return;
    const success = await updateZone(zone.id, edits);
    if (success) {
      setEditingZones(prev => {
        const next = { ...prev };
        delete next[zone.id];
        return next;
      });
    }
  };

  const handleAddZone = async () => {
    if (!newZone?.name) return;
    await addZone({
      name: newZone.name,
      min_km: newZone.min_km || 0,
      max_km: newZone.max_km || null,
      fixed_price: newZone.fixed_price || null,
      per_km_price: newZone.per_km_price || null,
      sort_order: zones.length + 1,
    } as any);
    setNewZone(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" /> Configuración
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona las zonas de tarificación y precios</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Zonas de tarificación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Define los rangos de kilómetros y precios para cada zona. La comisión se aplica automáticamente: 70% repartidor / 30% empresa.
          </p>

          <div className="space-y-3">
            {zones.map((zone) => (
              <div key={zone.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 rounded-lg border bg-muted/30">
                <div className="sm:col-span-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={getEditValue(zone, 'name') as string}
                    onChange={(e) => setEditValue(zone.id, 'name', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Desde (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={getEditValue(zone, 'min_km') as number}
                    onChange={(e) => setEditValue(zone.id, 'min_km', parseFloat(e.target.value) || 0)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hasta (km)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(getEditValue(zone, 'max_km') as number) ?? ''}
                    onChange={(e) => setEditValue(zone.id, 'max_km', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="∞"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Precio fijo (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(getEditValue(zone, 'fixed_price') as number) ?? ''}
                    onChange={(e) => setEditValue(zone.id, 'fixed_price', e.target.value ? parseFloat(e.target.value) : null)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">€/km extra</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(getEditValue(zone, 'per_km_price') as number) ?? ''}
                    onChange={(e) => setEditValue(zone.id, 'per_km_price', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Solo zona abierta"
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-1">
                  {editingZones[zone.id] && (
                    <Button size="sm" onClick={() => handleSave(zone)} className="flex-1">
                      <Save className="w-3 h-3 mr-1" /> Guardar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteZone(zone.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {newZone ? (
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="sm:col-span-1">
                <Label className="text-xs">Nombre</Label>
                <Input value={newZone.name || ''} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Desde (km)</Label>
                <Input type="number" step="0.1" value={newZone.min_km || ''} onChange={(e) => setNewZone({ ...newZone, min_km: parseFloat(e.target.value) || 0 })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Hasta (km)</Label>
                <Input type="number" step="0.1" value={newZone.max_km ?? ''} onChange={(e) => setNewZone({ ...newZone, max_km: e.target.value ? parseFloat(e.target.value) : null })} placeholder="∞" className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Precio fijo (€)</Label>
                <Input type="number" step="0.01" value={newZone.fixed_price ?? ''} onChange={(e) => setNewZone({ ...newZone, fixed_price: e.target.value ? parseFloat(e.target.value) : null })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">€/km extra</Label>
                <Input type="number" step="0.01" value={newZone.per_km_price ?? ''} onChange={(e) => setNewZone({ ...newZone, per_km_price: e.target.value ? parseFloat(e.target.value) : null })} className="text-sm" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={handleAddZone} disabled={!newZone.name} className="flex-1">
                  <Save className="w-3 h-3 mr-1" /> Crear
                </Button>
                <Button size="sm" variant="outline" onClick={() => setNewZone(null)}>✕</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setNewZone({ name: '', min_km: 0, max_km: null, fixed_price: null, per_km_price: null, sort_order: zones.length + 1 })}>
              <Plus className="w-4 h-4 mr-2" /> Añadir zona
            </Button>
          )}

          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
            <p><strong>Precio fijo:</strong> Se aplica a la zona completa.</p>
            <p><strong>€/km extra:</strong> Se suma al precio fijo por cada km que exceda el límite inferior de la zona (solo para zonas sin límite superior).</p>
            <p><strong>Comisión:</strong> Repartidor 70% · Empresa 30% (aplicado automáticamente).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
