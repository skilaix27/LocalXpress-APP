import { useState } from 'react';
import { ProofImage } from '@/components/ui/ProofImage';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeliveryReceipt } from '@/components/admin/DeliveryReceipt';
import type { Stop } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Clock, Route, Image, Receipt, Store, CalendarClock, Package } from 'lucide-react';
import { getPackageSizeLabel } from '@/lib/package-size';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { adjustDistance, getDeliveryZoneWithRange, getDeliveryPrice } from '@/lib/delivery-zones';

interface ShopStopDetailDialogProps {
  stop: Stop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShopStopDetailDialog({ stop, open, onOpenChange }: ShopStopDetailDialogProps) {
  const [showReceipt, setShowReceipt] = useState(false);

  if (!stop) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setShowReceipt(false); }}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Detalle del pedido
          </span>
          <StatusBadge status={stop.status} />
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      {/* Receipt toggle for delivered stops */}
      {stop.status === 'delivered' && (
        <Button
          variant={showReceipt ? 'default' : 'outline'}
          className="w-full rounded-lg"
          onClick={() => setShowReceipt(!showReceipt)}
        >
          <Receipt className="w-4 h-4 mr-2" />
          {showReceipt ? 'Volver al detalle' : 'Ver justificante de entrega'}
        </Button>
      )}

      {showReceipt && stop.status === 'delivered' ? (
        <DeliveryReceipt stop={stop} />
      ) : (
        <div className="space-y-3">
          {(stop.order_code || stop.shop_name) && (
            <div className="text-center space-y-1">
              {stop.order_code && (
                <span className="text-lg font-mono font-bold bg-primary/10 text-primary px-4 py-2 rounded-lg inline-block">
                  {stop.order_code}
                </span>
              )}
              {stop.shop_name && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground font-medium">
                  <Store className="w-3.5 h-3.5" />
                  {stop.shop_name}
                </div>
              )}
            </div>
          )}

          <div className="bg-muted rounded-lg p-3 space-y-1.5">
            <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <User className="w-3.5 h-3.5" /> Cliente
            </h3>
            <p className="font-semibold text-sm">{stop.client_name}</p>
            {stop.client_phone && (
              <a href={`tel:${stop.client_phone}`} className="text-sm text-primary flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5" /> {stop.client_phone}
              </a>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
              <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Recogida</p>
                <p className="text-sm mt-0.5 break-words">{stop.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-muted rounded-lg p-3">
              <div className="w-2.5 h-2.5 rounded-full bg-status-delivered mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-status-delivered uppercase tracking-wider">Entrega</p>
                <p className="text-sm mt-0.5 break-words">{stop.delivery_address}</p>
              </div>
            </div>
          </div>

          {stop.distance_km != null ? (() => {
            const price = stop.price ?? getDeliveryPrice(stop.distance_km);
            return (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Route className="w-4 h-4 text-primary" />
                <span className="text-primary font-bold text-sm">{adjustDistance(stop.distance_km)} km</span>
                <span className="font-medium text-muted-foreground text-sm">· {getDeliveryZoneWithRange(stop.distance_km)}</span>
                {price != null && <span className="font-bold text-primary text-sm">· {price} €</span>}
              </div>
            );
          })() : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Route className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Pendiente de calcular</span>
            </div>
          )}

          {stop.client_notes && (
            <div className="space-y-1.5">
              <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" /> Notas
              </h3>
              <p className="text-sm bg-muted p-3 rounded-lg">{stop.client_notes}</p>
            </div>
          )}

          {stop.package_size && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{getPackageSizeLabel(stop.package_size)}</span>
            </div>
          )}

          <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
            {stop.scheduled_pickup_at && (
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CalendarClock className="w-3.5 h-3.5" />
                Recogida programada: {format(new Date(stop.scheduled_pickup_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </div>
            )}
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

          {stop.proof_photo_url && (
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Image className="w-3.5 h-3.5" /> Prueba de entrega
              </h3>
              <ProofImage proofPhotoUrl={stop.proof_photo_url} />
            </div>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
