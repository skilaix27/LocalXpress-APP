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
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
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
              <span className="text-lg font-mono font-bold bg-primary/10 text-primary px-4 py-2 rounded-2xl inline-block">
                {stop.order_code}
              </span>
            </div>
          )}

          {/* Client */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
            <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <User className="w-3.5 h-3.5" /> Cliente
            </h3>
            <p className="font-semibold text-base">{stop.client_name}</p>
            {stop.client_phone && (
              <a href={`tel:${stop.client_phone}`} className="text-sm text-primary flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5" /> {stop.client_phone}
              </a>
            )}
          </div>

          {/* Addresses */}
          <div className="space-y-2">
            <div className="flex items-start gap-3 bg-primary/5 rounded-2xl p-4 border border-primary/10">
              <div className="w-3 h-3 rounded-full bg-primary mt-1 shrink-0 ring-4 ring-primary/20" />
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Recogida</p>
                <p className="text-sm mt-0.5">{stop.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-status-delivered/5 rounded-2xl p-4 border border-status-delivered/10">
              <div className="w-3 h-3 rounded-full bg-status-delivered mt-1 shrink-0 ring-4 ring-status-delivered/20" />
              <div>
                <p className="text-[10px] font-bold text-status-delivered uppercase tracking-wider">Entrega</p>
                <p className="text-sm mt-0.5">{stop.delivery_address}</p>
              </div>
            </div>
          </div>

          {/* Distance */}
          {stop.distance_km != null && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <Route className="w-5 h-5 text-primary" />
              <span className="text-primary font-bold text-base">{adjustDistance(stop.distance_km)} km</span>
              <span className="font-medium text-muted-foreground">· {getDeliveryZone(stop.distance_km)}</span>
            </div>
          )}

          {/* Notes */}
          {stop.client_notes && (
            <div className="space-y-1.5">
              <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" /> Notas
              </h3>
              <p className="text-sm bg-muted/40 p-4 rounded-2xl">{stop.client_notes}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Creado: {format(new Date(stop.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
            </div>
            {stop.picked_at && (
              <div className="flex items-center gap-2 text-status-picked font-medium">
                <Clock className="w-3.5 h-3.5" />
                Recogido: {format(new Date(stop.picked_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </div>
            )}
            {stop.delivered_at && (
              <div className="flex items-center gap-2 text-status-delivered font-medium">
                <Clock className="w-3.5 h-3.5" />
                Entregado: {format(new Date(stop.delivered_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </div>
            )}
          </div>

          {/* Proof photo */}
          {stop.proof_photo_url && (
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Image className="w-3.5 h-3.5" /> Prueba de entrega
              </h3>
              <img
                src={stop.proof_photo_url}
                alt="Prueba de entrega"
                className="w-full rounded-2xl border shadow-sm"
              />
            </div>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
