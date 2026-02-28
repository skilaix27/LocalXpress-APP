import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Mail, Lock, Phone, User, Shield, Store, MapPin } from 'lucide-react';
import { AddressInput } from '@/components/admin/AddressInput';
import type { PlaceDetails } from '@/hooks/useGooglePlaces';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [pickupResolved, setPickupResolved] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '',
    role: 'driver' as 'admin' | 'driver' | 'shop',
    shop_name: '', default_pickup_address: '', default_pickup_lat: 0, default_pickup_lng: 0,
  });

  const roleLabels: Record<string, string> = { admin: 'Administrador', driver: 'Repartidor', shop: 'Tienda' };
  const resetForm = () => {
    setForm({ full_name: '', email: '', password: '', phone: '', role: 'driver', shop_name: '', default_pickup_address: '', default_pickup_lat: 0, default_pickup_lng: 0 });
    setPickupResolved(false);
  };

  const handlePickupResolved = (details: PlaceDetails) => {
    setForm(prev => ({ ...prev, default_pickup_address: details.formattedAddress, default_pickup_lat: details.lat, default_pickup_lng: details.lng }));
    setPickupResolved(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) { toast.error('Completa los campos obligatorios'); return; }
    if (form.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
    if (form.role === 'shop' && !form.shop_name.trim()) { toast.error('El nombre de la tienda es obligatorio'); return; }

    setLoading(true);
    try {
      const body: Record<string, any> = {
        email: form.email.trim(), password: form.password, full_name: form.full_name.trim(),
        phone: form.phone.trim() || null, role: form.role,
      };
      if (form.role === 'shop') {
        body.shop_name = form.shop_name.trim();
        if (pickupResolved) {
          body.default_pickup_address = form.default_pickup_address;
          body.default_pickup_lat = form.default_pickup_lat;
          body.default_pickup_lng = form.default_pickup_lng;
        }
      }

      const { data, error } = await supabase.functions.invoke('create-user', { body });
      if (error) {
        const msg = typeof error === 'object' && 'message' in error ? error.message : String(error);
        if (msg.includes('ya está registrado') || msg.includes('already been registered')) {
          toast.error('Este email ya está registrado', { description: 'Usa otro email o edita el usuario existente.' });
        } else { toast.error('Error al crear usuario', { description: msg }); }
        setLoading(false); return;
      }
      if (data?.error) {
        if (data.error.includes('ya está registrado') || data.error.includes('already been registered')) {
          toast.error('Este email ya está registrado', { description: 'Usa otro email o edita el usuario existente.' });
        } else { toast.error('Error al crear usuario', { description: data.error }); }
        setLoading(false); return;
      }

      toast.success('Usuario creado correctamente', { description: `${form.full_name} (${roleLabels[form.role]})` });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Error al crear usuario', { description: err.message });
    } finally { setLoading(false); }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> Crear usuario
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Añade un nuevo usuario al sistema.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Rol *</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="driver">🚴 Repartidor</SelectItem>
              <SelectItem value="shop">🏪 Tienda</SelectItem>
              <SelectItem value="admin">👑 Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.role === 'shop' && (
          <div className="space-y-2">
            <Label htmlFor="shop_name" className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Nombre de la tienda *</Label>
            <Input id="shop_name" placeholder="Ej: Panadería La Esquina" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="full_name" className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {form.role === 'shop' ? 'Persona de contacto *' : 'Nombre completo *'}</Label>
          <Input id="full_name" placeholder="Juan Pérez" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email *</Label>
          <Input id="email" type="email" placeholder="juan@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Contraseña *</Label>
          <Input id="password" type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Teléfono</Label>
          <Input id="phone" type="tel" placeholder="+34 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>

        {form.role === 'shop' && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Dirección habitual de recogida</Label>
            <AddressInput value={form.default_pickup_address} onChange={(v) => setForm({ ...form, default_pickup_address: v })} onResolved={handlePickupResolved} onClear={() => setPickupResolved(false)} resolved={pickupResolved} placeholder="Ej: Carrer de Balmes 145, Barcelona" />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Creando...' : 'Crear usuario'}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
