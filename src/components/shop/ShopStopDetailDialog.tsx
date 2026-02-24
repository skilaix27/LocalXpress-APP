import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeliveryReceipt } from '@/components/admin/DeliveryReceipt';
import type { Stop } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Clock, Route, Image, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { adjustDistance, getDeliveryZone } from '@/lib/delivery-zones';

interface ShopStopDetailDialogProps {
  stop: Stop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShopStopDetailDialog({ stop, open, onOpenChange }: ShopStopDetailDialogProps) {
  const [showReceipt, setShowReceipt] = useState(false);

  if (!stop) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setShowReceipt(false); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Detalle del pedido
            </span>
            <StatusBadge status={stop.status} />
          </DialogTitle>
        </DialogHeader>

        {/* Receipt toggle for delivered stops */}
        {stop.status === 'delivered' && (
          <Button
            variant={showReceipt ? 'default' : 'outline'}
            className="w-full"
            onClick={() => setShowReceipt(!showReceipt)}
          >
            <Receipt className="w-4 h-4 mr-2" />
            {showReceipt ? 'Volver al detalle' : 'Ver justificante de entrega'}
          </Button>
        )}

        {showReceipt && stop.status === 'delivered' ? (
          <DeliveryReceipt stop={stop} />
        ) : (

        <div className="space-y-4">
          {/* Order code */}
          {stop.order_code && (
            <div className="text-center">
              <span className="text-lg font-mono font-bold bg-muted px-3 py-1.5 rounded-lg">
                {stop.order_code}
              </span>
            </div>
          )}

          {/* Client */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
              <User className="w-4 h-4" /> Cliente
            </h3>
            <p className="font-medium">{stop.client_name}</p>
            {stop.client_phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {stop.client_phone}
              </p>
            )}
          </div>

          {/* Addresses */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-primary mt-1 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Recogida</p>
                <p className="text-sm">{stop.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-full bg-status-delivered mt-1 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Entrega</p>
                <p className="text-sm">{stop.delivery_address}</p>
              </div>
            </div>
          </div>

          {/* Distance */}
          {stop.distance_km != null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <Route className="w-4 h-4 text-primary" />
              <span className="text-primary font-bold">{adjustDistance(stop.distance_km)} km</span>
              <span className="font-medium">· {getDeliveryZone(stop.distance_km)}</span>
            </div>
          )}

          {/* Notes */}
          {stop.client_notes && (
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Notas
              </h3>
              <p className="text-sm bg-muted/50 p-3 rounded-lg">{stop.client_notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Creado: {format(new Date(stop.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
            </div>
            {stop.picked_at && (
              <div className="flex items-center gap-2 text-status-picked">
                <Clock className="w-3.5 h-3.5" />
                Recogido: {format(new Date(stop.picked_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </div>
            )}
            {stop.delivered_at && (
              <div className="flex items-center gap-2 text-status-delivered">
                <Clock className="w-3.5 h-3.5" />
                Entregado: {format(new Date(stop.delivered_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </div>
            )}
          </div>

          {/* Proof photo */}
          {stop.proof_photo_url && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
                <Image className="w-4 h-4" /> Prueba de entrega
              </h3>
              <img
                src={stop.proof_photo_url}
                alt="Prueba de entrega"
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
