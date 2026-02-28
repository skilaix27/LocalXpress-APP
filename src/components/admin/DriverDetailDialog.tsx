import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StopCard } from '@/components/admin/StopCard';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import type { Profile, Stop } from '@/lib/supabase-types';
import { User, Phone, Lock, Save, Package, Truck, CheckCircle } from 'lucide-react';

interface DriverDetailDialogProps {
  driver: Profile | null;
  stops: Stop[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function DriverDetailDialog({ driver, stops, open, onOpenChange, onUpdate }: DriverDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', password: '', is_active: true });
  const [stopFilter, setStopFilter] = useState<'all' | 'pending' | 'picked' | 'delivered'>('all');

  useEffect(() => {
    if (driver) {
      setForm({ full_name: driver.full_name, phone: driver.phone || '', password: '', is_active: driver.is_active ?? true });
      setStopFilter('all');
    }
  }, [driver]);

  const driverStops = useMemo(() => stops.filter((s) => s.driver_id === driver?.id), [stops, driver]);
  const filteredStops = useMemo(() => stopFilter === 'all' ? driverStops : driverStops.filter((s) => s.status === stopFilter), [driverStops, stopFilter]);
  const counts = {
    all: driverStops.length,
    pending: driverStops.filter((s) => s.status === 'pending').length,
    picked: driverStops.filter((s) => s.status === 'picked').length,
    delivered: driverStops.filter((s) => s.status === 'delivered').length,
  };

  const handleSave = async () => {
    if (!driver) return;
    if (!form.full_name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (form.password && form.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }

    setLoading(true);
    try {
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
        <ResponsiveDialogDescription>Edita la información del repartidor y consulta sus paradas asignadas.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <Tabs defaultValue="edit" className="mt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Editar perfil</TabsTrigger>
          <TabsTrigger value="stops">Paradas ({counts.all})</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit_name" className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Nombre completo</Label>
            <Input id="edit_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Teléfono</Label>
            <Input id="edit_phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_password" className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Nueva contraseña</Label>
            <Input id="edit_password" type="password" placeholder="Dejar vacío para no cambiar" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Estado activo</p>
              <p className="text-xs text-muted-foreground">{form.is_active ? 'El repartidor puede iniciar sesión' : 'El repartidor está desactivado'}</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            <Save className="w-4 h-4 mr-2" /> {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </TabsContent>

        <TabsContent value="stops" className="mt-4 space-y-4">
          <Tabs value={stopFilter} onValueChange={(v) => setStopFilter(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 gap-1 text-xs">Todas ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 gap-1 text-xs"><Package className="w-3 h-3" /> ({counts.pending})</TabsTrigger>
              <TabsTrigger value="picked" className="flex-1 gap-1 text-xs"><Truck className="w-3 h-3" /> ({counts.picked})</TabsTrigger>
              <TabsTrigger value="delivered" className="flex-1 gap-1 text-xs"><CheckCircle className="w-3 h-3" /> ({counts.delivered})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {filteredStops.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" /> No hay paradas con este filtro
              </div>
            ) : filteredStops.map((stop) => <StopCard key={stop.id} stop={stop} />)}
          </div>
        </TabsContent>
      </Tabs>
    </ResponsiveDialog>
  );
}
