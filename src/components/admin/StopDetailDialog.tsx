import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Stop, Profile } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Trash2, Truck, Clock, Camera } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StopDetailDialogProps {
  stop: Stop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Profile[];
  onUpdate: () => void;
}

export function StopDetailDialog({
  stop,
  open,
  onOpenChange,
  drivers,
  onUpdate,
}: StopDetailDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  if (!stop) return null;

  const assignDriver = async (driverId: string) => {
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('stops')
        .update({ driver_id: driverId === 'unassign' ? null : driverId })
        .eq('id', stop.id);

      if (error) throw error;
      toast.success(driverId === 'unassign' ? 'Repartidor desasignado' : 'Repartidor asignado');
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {stop.client_name}
          </DialogTitle>
          <DialogDescription>Detalle de la parada</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estado</span>
            <StatusBadge status={stop.status} />
          </div>

          {/* Pickup */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Recogida
            </div>
            <p className="text-sm text-muted-foreground pl-4">{stop.pickup_address}</p>
          </div>

          {/* Delivery */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-status-delivered" />
              Entrega
            </div>
            <p className="text-sm text-muted-foreground pl-4">{stop.delivery_address}</p>
          </div>

          {/* Phone */}
          {stop.client_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${stop.client_phone}`} className="text-primary hover:underline">
                {stop.client_phone}
              </a>
            </div>
          )}

          {/* Notes */}
          {stop.client_notes && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">{stop.client_notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-1 text-xs text-muted-foreground">
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

          {/* Proof Photo */}
          {stop.proof_photo_url && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Camera className="w-4 h-4 text-status-delivered" />
                Foto de entrega
              </div>
              <img
                src={stop.proof_photo_url}
                alt="Prueba de entrega"
                className="w-full rounded-lg border max-h-64 object-cover"
              />
            </div>
          )}

          {/* Driver Assignment */}
          {stop.status !== 'delivered' && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Repartidor asignado
              </label>
              <Select
                value={stop.driver_id || 'unassign'}
                onValueChange={assignDriver}
                disabled={assigning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">Sin asignar</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Delete */}
          <div className="pt-2 border-t">
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
      </DialogContent>
    </Dialog>
  );
}
