import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Mail, Lock, Phone, User, Shield } from 'lucide-react';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onSuccess }: CreateUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'driver' as 'admin' | 'driver',
  });

  const resetForm = () => {
    setForm({ full_name: '', email: '', password: '', phone: '', role: 'driver' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Usuario creado correctamente', {
        description: `${form.full_name} (${form.role === 'admin' ? 'Administrador' : 'Repartidor'})`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error('Error al crear usuario', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Crear usuario
          </DialogTitle>
          <DialogDescription>
            Añade un nuevo repartidor o administrador al sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Nombre completo *
            </Label>
            <Input
              id="full_name"
              placeholder="Juan Pérez"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@empresa.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Contraseña *
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Teléfono
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+34 600 000 000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Rol *
            </Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as 'admin' | 'driver' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">🚴 Repartidor</SelectItem>
                <SelectItem value="admin">👑 Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creando...' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
