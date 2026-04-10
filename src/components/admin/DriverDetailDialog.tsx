import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StopCard } from '@/components/admin/StopCard';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/pricing';
import type { Profile, Stop } from '@/lib/supabase-types';
import { User, Phone, Lock, Save, Package, Truck, CheckCircle, CreditCard, MapPin, FileText, Euro, Landmark } from 'lucide-react';

interface DriverDetailDialogProps {
  driver: Profile | null;
  stops: Stop[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function DriverDetailDialog({ driver, stops, open, onOpenChange, onUpdate }: DriverDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone: '', password: '', is_active: true,
    nif: '', fiscal_address: '', iban: '', admin_notes: '',
  });
  const [stopFilter, setStopFilter] = useState<'all' | 'pending' | 'picked' | 'delivered'>('all');

  useEffect(() => {
    if (driver) {
      setForm({
        full_name: driver.full_name,
        phone: driver.phone || '',
        password: '',
        is_active: driver.is_active ?? true,
        nif: driver.nif || '',
        fiscal_address: driver.fiscal_address || '',
        iban: driver.iban || '',
        admin_notes: driver.admin_notes || '',
      });
      setStopFilter('all');
    }
  }, [driver]);

  const driverStops = useMemo(() => stops.filter((s) => s.driver_id === driver?.id), [stops, driver]);
  const filteredStops = useMemo(() => stopFilter === 'all' ? driverStops : driverStops.filter((s) => s.status === stopFilter), [driverStops, stopFilter]);

  const counts = {
    all: driverStops.length,
    pending: driverStops.filter((s) => s.status === 'pending' || s.status === 'assigned').length,
    picked: driverStops.filter((s) => s.status === 'picked').length,
    delivered: driverStops.filter((s) => s.status === 'delivered').length,
  };

  const totalEarned = driverStops.reduce((sum, s) => sum + (Number(s.price_driver) || 0), 0);
  const totalRevenue = driverStops.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  const handleSave = async () => {
    if (!driver) return;
    if (!form.full_name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (form.password && form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }

    setLoading(true);
    try {
      // Update profile fields directly
      const { error: profileError } = await supabase.from('profiles').update({
        nif: form.nif || null,
        fiscal_address: form.fiscal_address || null,
        iban: form.iban || null,
        admin_notes: form.admin_notes || null,
      } as any).eq('id', driver.id);
      if (profileError) throw profileError;

      // Update via edge function (handles name, phone, password, is_active)
      const { data, error } = await supabase.functions.invoke('update-user', {
        body: { profile_id: driver.id, full_name: form.full_name.trim(), phone: form.phone.trim() || null, password: form.password || undefined, is_active: form.is_active },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Repartidor actualizado');
      onUpdate();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Error al actualizar', { description: err.message });
    } finally { setLoading(false); }
  };

  if (!driver) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> {driver.full_name}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Ficha completa del repartidor</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <Tabs defaultValue="edit" className="mt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Datos personales</TabsTrigger>
          <TabsTrigger value="stops">Servicios ({counts.all})</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">{counts.all}</p>
              <p className="text-[10px] text-muted-foreground">Total servicios</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">{counts.delivered}</p>
              <p className="text-[10px] text-muted-foreground">Entregados</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-lg font-bold text-primary">{formatPrice(totalEarned)}</p>
              <p className="text-[10px] text-muted-foreground">Ganado (70%)</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Nombre completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><CreditCard className="w-3 h-3" /> DNI/NIE</Label>
              <Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} placeholder="12345678A" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección domiciliar</Label>
              <Input value={form.fiscal_address} onChange={(e) => setForm({ ...form, fiscal_address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Landmark className="w-3 h-3" /> IBAN</Label>
              <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="ES00 0000 0000 0000 0000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Lock className="w-3 h-3" /> Nueva contraseña</Label>
              <Input type="password" placeholder="Dejar vacío para no cambiar" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Notas internas</Label>
              <Textarea value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Estado activo</p>
                <p className="text-xs text-muted-foreground">{form.is_active ? 'Puede iniciar sesión' : 'Desactivado'}</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            <Save className="w-4 h-4 mr-2" /> {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </TabsContent>

        <TabsContent value="stops" className="mt-4 space-y-4">
          <Tabs value={stopFilter} onValueChange={(v) => setStopFilter(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 gap-1 text-xs">Todos ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 gap-1 text-xs"><Package className="w-3 h-3" /> ({counts.pending})</TabsTrigger>
              <TabsTrigger value="picked" className="flex-1 gap-1 text-xs"><Truck className="w-3 h-3" /> ({counts.picked})</TabsTrigger>
              <TabsTrigger value="delivered" className="flex-1 gap-1 text-xs"><CheckCircle className="w-3 h-3" /> ({counts.delivered})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {filteredStops.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" /> No hay servicios con este filtro
              </div>
            ) : filteredStops.map((stop) => (
              <div key={stop.id} className="p-3 rounded-lg border text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{stop.order_code || stop.client_name}</span>
                  <span className="text-xs text-muted-foreground">{stop.status}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{stop.delivery_address}</p>
                {stop.price != null && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-primary">{formatPrice(Number(stop.price_driver))} (70%)</span>
                    <span className="text-muted-foreground">Total: {formatPrice(Number(stop.price))}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-primary/10 flex items-center justify-between">
            <span className="text-sm font-medium">Total ganado</span>
            <span className="text-lg font-bold text-primary">{formatPrice(totalEarned)}</span>
          </div>
        </TabsContent>
      </Tabs>
    </ResponsiveDialog>
  );
}
