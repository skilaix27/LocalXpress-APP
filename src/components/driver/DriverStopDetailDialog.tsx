import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { MapPin, Phone, FileText, Package, Store, Clock, Copy, Check, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Stop } from '@/lib/supabase-types';
import { getPackageSizeLabel } from '@/lib/package-size';
import { adjustDistance, getDeliveryZone, getDeliveryPrice } from '@/lib/delivery-zones';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';

interface DriverStopDetailDialogProps {
  stop: Stop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DriverStopDetailDialog({ stop, open, onOpenChange }: DriverStopDetailDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      toast.success('Copiado al portapapeles');
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Detalles de la parada
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Información completa de recogida y entrega
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="space-y-4">
        {/* Client info */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-base">{stop.client_name}</p>
            {stop.order_code && (
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {stop.order_code}
              </span>
            )}
          </div>
        </div>

        {/* Pickup address */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground tracking-wider">DIRECCIÓN DE RECOGIDA</p>
              <button
                onClick={() => copyToClipboard(stop.pickup_address, 'pickup')}
                className="p-1.5 rounded-md hover:bg-muted active:scale-95 transition-all"
              >
                {copiedField === 'pickup' ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-sm leading-relaxed font-medium">{stop.pickup_address}</p>
            {stop.shop_name && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Store className="w-3.5 h-3.5" />
                {stop.shop_name}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery address */}
        <Card className="border-l-4 border-l-status-delivered">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground tracking-wider">DIRECCIÓN DE ENTREGA</p>
              <button
                onClick={() => copyToClipboard(stop.delivery_address, 'delivery')}
                className="p-1.5 rounded-md hover:bg-muted active:scale-95 transition-all"
              >
                {copiedField === 'delivery' ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <p className="text-sm leading-relaxed font-medium">{stop.delivery_address}</p>
          </CardContent>
        </Card>

        {/* Phone */}
        {stop.client_phone && (
          <a href={`tel:${stop.client_phone}`} className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg active:bg-primary/10 transition-colors">
            <Phone className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">{stop.client_phone}</span>
          </a>
        )}

        {/* Schedule */}
        {stop.scheduled_pickup_at && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground tracking-wider">RECOGIDA PROGRAMADA</p>
              <p className="text-sm font-semibold">{format(new Date(stop.scheduled_pickup_at), "EEEE d 'de' MMMM · HH:mm", { locale: es })}</p>
            </div>
          </div>
        )}

        {/* Package size */}
        {stop.package_size && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Package className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground tracking-wider">TAMAÑO DEL PAQUETE</p>
              <p className="text-sm font-semibold">{getPackageSizeLabel(stop.package_size)}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {stop.client_notes && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 tracking-wider mb-1">NOTAS / INSTRUCCIONES</p>
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">{stop.client_notes}</p>
              </div>
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
