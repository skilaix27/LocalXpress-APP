import { forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Stop, Profile } from '@/lib/supabase-types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, MapPin, User, Clock, Truck, Camera, Package } from 'lucide-react';
import logoLocalxpress from '@/assets/logo-localxpress.png';

interface DeliveryReceiptProps {
  stop: Stop;
  driver?: Profile | null;
}

export const DeliveryReceipt = forwardRef<HTMLDivElement, DeliveryReceiptProps>(
  ({ stop, driver }, ref) => {
    return (
      <div ref={ref} className="space-y-4">
        <Card className="border-2 border-status-delivered/30 overflow-hidden">
          {/* Header */}
          <div className="bg-status-delivered/10 p-4 text-center space-y-2">
            <img src={logoLocalxpress} alt="LocalXpress" className="h-8 mx-auto" />
            <CheckCircle className="w-6 h-6 text-status-delivered mx-auto" />
            <h3 className="text-lg font-bold">Justificante de Entrega</h3>
            <p className="text-xs text-muted-foreground">
              ID: {stop.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <CardContent className="p-4 space-y-4">
            {/* Client */}
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-semibold">{stop.client_name}</p>
                {stop.client_phone && (
                  <p className="text-sm text-muted-foreground">{stop.client_phone}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Addresses */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Recogida</p>
                  <p className="text-sm">{stop.pickup_address}</p>
                  {stop.picked_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(stop.picked_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-status-delivered shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Entrega</p>
                  <p className="text-sm">{stop.delivery_address}</p>
                  {stop.delivered_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(stop.delivered_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Driver */}
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Repartidor</p>
                <p className="font-semibold">{driver?.full_name || 'No asignado'}</p>
                {driver?.phone && (
                  <p className="text-sm text-muted-foreground">{driver.phone}</p>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Hora de entrega</p>
                <p className="font-semibold">
                  {stop.delivered_at
                    ? format(new Date(stop.delivered_at), "EEEE dd 'de' MMMM yyyy, HH:mm:ss", { locale: es })
                    : 'Pendiente'}
                </p>
              </div>
            </div>

            {/* Proof Photo */}
            {stop.proof_photo_url && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Camera className="w-4 h-4 text-status-delivered" />
                    Prueba fotográfica
                  </div>
                  <img
                    src={stop.proof_photo_url}
                    alt="Prueba de entrega"
                    className="w-full rounded-lg border max-h-72 object-cover"
                  />
                </div>
              </>
            )}

            {/* Notes */}
            {stop.client_notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm">{stop.client_notes}</p>
                </div>
              </>
            )}
          </CardContent>

          {/* Footer */}
          <div className="bg-muted/50 p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Generado el {format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
            <p className="text-xs text-muted-foreground font-medium">LocalXpress</p>
          </div>
        </Card>
      </div>
    );
  }
);

DeliveryReceipt.displayName = 'DeliveryReceipt';
