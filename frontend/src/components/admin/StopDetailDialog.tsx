import { useState } from 'react';
import { ProofImage } from '@/components/ui/ProofImage';
import { getDeliveryZone, adjustDistance, getDeliveryPrice } from '@/lib/delivery-zones';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Stop, Profile, StopStatus } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Trash2, Truck, Clock, Camera, Receipt, Route, Store, CalendarClock, Pencil, Save, X, Package } from 'lucide-react';
import { getPackageSizeLabel } from '@/lib/package-size';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DeliveryReceipt } from './DeliveryReceipt';

interface StopDetailDialogProps {
  stop: Stop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Profile[];
  onUpdate: () => void;
  shopName?: string | null;
}

export function StopDetailDialog({ stop, open, onOpenChange, drivers, onUpdate, shopName }: StopDetailDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<StopStatus>('pending');

  if (!stop) return null;

  const startEditing = () => {
    setEditName(stop.client_name);
    setEditPhone(stop.client_phone || '');
    setEditNotes(stop.client_notes || '');
    setEditStatus(stop.status);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        client_name: editName.trim(),
        client_phone: editPhone.trim() || null,
        client_notes: editNotes.trim() || null,
        status: editStatus,
      };

      // If status changed to delivered, set delivered_at
      if (editStatus === 'delivered' && stop.status !== 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }
      // If status changed from delivered to something else, clear delivered_at
      if (editStatus !== 'delivered' && stop.status === 'delivered') {
        updateData.delivered_at = null;
      }
      // If changing to pending, clear driver
      if (editStatus === 'pending') {
        updateData.driver_id = null;
      }

      const { error } = await supabase.from('stops').update(updateData).eq('id', stop.id);
      if (error) throw error;
      toast.success('Parada actualizada');
      setEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const assignDriver = async (driverId: string) => {
    setAssigning(true);
    try {
      const isUnassign = driverId === 'unassign';
      const updateData: any = { driver_id: isUnassign ? null : driverId };
      if (!isUnassign && stop.status === 'pending') updateData.status = 'assigned';
      if (isUnassign && stop.status === 'assigned') updateData.status = 'pending';

      const { error } = await supabase.from('stops').update(updateData).eq('id', stop.id);
      if (error) throw error;
      toast.success(isUnassign ? 'Repartidor desasignado' : 'Repartidor asignado');
      onUpdate();
    } catch (error: any) {
      toast.error('Error al asignar', { description: error.message });
    } finally {
      setAssigning(false);
    }
  };

  const deleteStop = async () => {
    setDeleting(true);
    try {
      // Delete proof photo from storage if exists
      if (stop.proof_photo_url) {
        await supabase.storage.from('delivery-proofs').remove([stop.proof_photo_url]);
      }

      const { error } = await supabase.from('stops').delete().eq('id', stop.id);
      if (error) throw error;
      toast.success('Parada eliminada');
      onOpenChange(false);
      onUpdate();
    } catch (error: any) {
      toast.error('Error al eliminar', { description: error.message });
    } finally {
      setDeleting(false);
    }
  };

  const currentDriver = drivers.find((d) => d.id === stop.driver_id);

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          {stop.client_name}
          {stop.order_code && (
            <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{stop.order_code}</span>
          )}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Detalle de la parada</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      {stop.status === 'delivered' && !editing && (
        <Button variant={showReceipt ? 'default' : 'outline'} className="w-full" onClick={() => setShowReceipt(!showReceipt)}>
          <Receipt className="w-4 h-4 mr-2" />
          {showReceipt ? 'Volver al detalle' : 'Ver justificante de entrega'}
        </Button>
      )}

      {showReceipt && stop.status === 'delivered' && !editing ? (
        <DeliveryReceipt stop={stop} driver={currentDriver} />
      ) : editing ? (
        /* ─── EDIT MODE ─── */
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del cliente</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Opcional" rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={editStatus} onValueChange={(v) => setEditStatus(v as StopStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="assigned">Asignado</SelectItem>
                <SelectItem value="picked">Recogido</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={saveChanges} disabled={saving || !editName.trim()}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button variant="outline" onClick={cancelEditing} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        /* ─── VIEW MODE ─── */
        <div className="space-y-4">
          {shopName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Store className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{shopName}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estado</span>
            <StatusBadge status={stop.status} />
          </div>

          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-primary" /> Recogida
            </div>
            <p className="text-sm text-muted-foreground pl-4">{stop.pickup_address}</p>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-status-delivered" /> Entrega
            </div>
            <p className="text-sm text-muted-foreground pl-4">{stop.delivery_address}</p>
          </div>

          {stop.distance_km != null && (() => {
            const price = stop.price ?? getDeliveryPrice(stop.distance_km);
            return (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
                <Route className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-bold">{adjustDistance(stop.distance_km)} km</span>
                <span className="text-sm font-medium">· {getDeliveryZone(stop.distance_km)}</span>
                {price != null && <span className="text-sm font-bold text-primary">· {price} €</span>}
              </div>
            );
          })()}

          {stop.client_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${stop.client_phone}`} className="text-primary hover:underline">{stop.client_phone}</a>
            </div>
          )}

          {stop.client_notes && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">{stop.client_notes}</p>
            </div>
          )}

          {stop.package_size && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{getPackageSizeLabel(stop.package_size)}</span>
            </div>
          )}

          <div className="space-y-1 text-xs text-muted-foreground">
            {stop.scheduled_pickup_at && (
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CalendarClock className="w-3 h-3" />
                Recogida programada: {format(new Date(stop.scheduled_pickup_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Creada {formatDistanceToNow(new Date(stop.created_at), { addSuffix: true, locale: es })}
            </div>
            {stop.picked_at && (
              <div className="flex items-center gap-2">
                <Truck className="w-3 h-3" />
                Recogida: {format(new Date(stop.picked_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </div>
            )}
            {stop.delivered_at && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                Entregada: {format(new Date(stop.delivered_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </div>
            )}
          </div>

          {stop.proof_photo_url && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Camera className="w-4 h-4 text-status-delivered" /> Foto de entrega
              </div>
              <ProofImage proofPhotoUrl={stop.proof_photo_url} />
            </div>
          )}

          {(stop.status === 'pending' || stop.status === 'assigned') && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Truck className="w-4 h-4" /> Repartidor asignado
              </label>
              <Select value={stop.driver_id || 'unassign'} onValueChange={assignDriver} disabled={assigning}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Sin asignar</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>{driver.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Admin actions: Edit + Delete */}
          <div className="pt-2 border-t space-y-2">
            <Button variant="outline" className="w-full" onClick={startEditing}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar parada
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={deleting}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? 'Eliminando...' : 'Eliminar parada'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar esta parada?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará permanentemente la parada de {stop.client_name}. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteStop}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
