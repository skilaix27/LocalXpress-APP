import { useState } from 'react';
import { usePricingZones } from '@/hooks/usePricingZones';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Plus, Pencil, Trash2, Save, X, Route } from 'lucide-react';
import type { PricingZone } from '@/lib/delivery-zones';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ZoneForm {
  name: string;
  min_km: string;
  max_km: string;
  fixed_price: string;
  price_driver: string;
  sort_order: string;
}

const emptyForm: ZoneForm = { name: '', min_km: '', max_km: '', fixed_price: '', price_driver: '', sort_order: '' };

export default function AdminSettings() {
  const { zones, loading, saveZone, deleteZone } = usePricingZones();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ZoneForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const startEdit = (z: PricingZone) => {
    setEditingId(z.id);
    setCreating(false);
    setForm({
      name: z.name,
      min_km: String(z.min_km),
      max_km: z.max_km != null ? String(z.max_km) : '',
      fixed_price: z.fixed_price != null ? String(z.fixed_price) : '',
      price_driver: z.price_driver != null ? String(z.price_driver) : '0',
      sort_order: String(z.sort_order),
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setForm({ ...emptyForm, sort_order: String(zones.length + 1) });
  };

  const cancel = () => {
    setEditingId(null);
    setCreating(false);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.min_km || !form.fixed_price) {
      toast.error('Nombre, km mínimo y precio cliente son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await saveZone({
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        min_km: parseFloat(form.min_km),
        max_km: form.max_km ? parseFloat(form.max_km) : null,
        fixed_price: parseFloat(form.fixed_price),
        per_km_price: null,
        price_driver: form.price_driver ? parseFloat(form.price_driver) : 0,
        sort_order: parseInt(form.sort_order) || zones.length + 1,
      });
      toast.success(editingId ? 'Zona actualizada' : 'Zona creada');
      cancel();
    } catch (e: any) {
      toast.error('Error', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteZone(id);
      toast.success('Zona eliminada');
      if (editingId === id) cancel();
    } catch (e: any) {
      toast.error('Error al eliminar', { description: e.message });
    }
  };

  const renderForm = () => (
    <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nombre</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Zona X" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Km mínimo</Label>
          <Input type="number" step="0.1" value={form.min_km} onChange={e => setForm(f => ({ ...f, min_km: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Km máximo</Label>
          <Input type="number" step="0.1" value={form.max_km} onChange={e => setForm(f => ({ ...f, max_km: e.target.value }))} placeholder="Sin límite" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Precio cliente (€)</Label>
          <Input type="number" step="0.01" value={form.fixed_price} onChange={e => setForm(f => ({ ...f, fixed_price: e.target.value }))} placeholder="0.00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Precio repartidor (€)</Label>
          <Input type="number" step="0.01" value={form.price_driver} onChange={e => setForm(f => ({ ...f, price_driver: e.target.value }))} placeholder="0.00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Margen empresa</Label>
          <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
            {form.fixed_price && form.price_driver
              ? `${(parseFloat(form.fixed_price || '0') - parseFloat(form.price_driver || '0')).toFixed(2)} €`
              : form.fixed_price
              ? `${parseFloat(form.fixed_price).toFixed(2)} €`
              : '—'}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" /> Configuración
          </h1>
          <p className="text-muted-foreground text-sm">Gestiona las zonas de tarificación</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Route className="w-5 h-5" /> Zonas de precio ({zones.length})
            </CardTitle>
            <Button size="sm" onClick={startCreate} disabled={creating}>
              <Plus className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Añadir zona</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {creating && renderForm()}

          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Cargando zonas...</p>
          ) : zones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay zonas configuradas</p>
          ) : (
            <div className="space-y-2">
              {zones.map((z) =>
                editingId === z.id ? (
                  <div key={z.id}>{renderForm()}</div>
                ) : (
                  <div
                    key={z.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="font-semibold text-sm min-w-[70px]">{z.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {z.min_km} — {z.max_km != null ? `${z.max_km} km` : '∞'}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {z.fixed_price != null ? `${z.fixed_price} €` : z.per_km_price != null ? `${z.per_km_price} €/km` : '—'}
                      </span>
                      {z.price_driver != null && z.price_driver > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Rep. {z.price_driver} €
                          {z.fixed_price != null && (
                            <> · Margen {(z.fixed_price - z.price_driver).toFixed(2)} €</>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(z)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar {z.name}?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(z.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground pt-2">
            Las distancias se calculan con Google Maps (sin peajes). Se aplica un margen de +150m: si el destino está a menos de 150m del límite de la zona superior, se asigna la zona superior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
