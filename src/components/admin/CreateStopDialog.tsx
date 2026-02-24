import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Profile } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Loader2, CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouteDistance } from '@/hooks/useRouteDistance';
import { AddressInput } from '@/components/admin/AddressInput';
import type { PlaceDetails } from '@/hooks/useGooglePlaces';
import { getDeliveryZone, adjustDistance } from '@/lib/delivery-zones';
import { generateOrderCode } from '@/lib/order-code';

const stopSchema = z.object({
  pickup_address: z.string().min(1, 'Dirección de recogida requerida'),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  delivery_address: z.string().min(1, 'Dirección de entrega requerida'),
  delivery_lat: z.number(),
  delivery_lng: z.number(),
  client_name: z.string().min(1, 'Nombre del cliente requerido'),
  client_phone: z.string().optional(),
  client_notes: z.string().optional(),
  driver_id: z.string().optional(),
  scheduled_date: z.date().optional(),
  scheduled_time: z.string().optional(),
});

type StopFormData = z.infer<typeof stopSchema>;

interface CreateStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Profile[];
  onSuccess?: () => void;
}

export function CreateStopDialog({ open, onOpenChange, drivers, onSuccess }: CreateStopDialogProps) {
  const [loading, setLoading] = useState(false);
  const [pickupResolved, setPickupResolved] = useState(false);
  const [deliveryResolved, setDeliveryResolved] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const { calculateDistance, loading: calculatingRoute } = useRouteDistance();

  const form = useForm<StopFormData>({
    resolver: zodResolver(stopSchema),
    defaultValues: {
      pickup_address: '', pickup_lat: 41.3851, pickup_lng: 2.1734,
      delivery_address: '', delivery_lat: 41.3920, delivery_lng: 2.1650,
      client_name: '', client_phone: '', client_notes: '',
      driver_id: '', scheduled_date: undefined, scheduled_time: '',
    },
  });

  const handleAddressResolved = async (type: 'pickup' | 'delivery', details: PlaceDetails) => {
    if (type === 'pickup') {
      form.setValue('pickup_address', details.formattedAddress);
      form.setValue('pickup_lat', details.lat);
      form.setValue('pickup_lng', details.lng);
      setPickupResolved(true);
    } else {
      form.setValue('delivery_address', details.formattedAddress);
      form.setValue('delivery_lat', details.lat);
      form.setValue('delivery_lng', details.lng);
      setDeliveryResolved(true);
    }

    const pResolved = type === 'pickup' ? true : pickupResolved;
    const dResolved = type === 'delivery' ? true : deliveryResolved;
    if (pResolved && dResolved) {
      const pLat = type === 'pickup' ? details.lat : form.getValues('pickup_lat');
      const pLng = type === 'pickup' ? details.lng : form.getValues('pickup_lng');
      const dLat = type === 'delivery' ? details.lat : form.getValues('delivery_lat');
      const dLng = type === 'delivery' ? details.lng : form.getValues('delivery_lng');
      const route = await calculateDistance(pLat, pLng, dLat, dLng);
      if (route) setRouteDistance(route.distanceKm);
    }
  };

  const onSubmit = async (data: StopFormData) => {
    if (!pickupResolved || !deliveryResolved) {
      toast.error('Selecciona las direcciones primero', {
        description: 'Escribe y selecciona una dirección de la lista de sugerencias',
      });
      return;
    }

    setLoading(true);
    try {
      let scheduledPickupAt: string | null = null;
      if (data.scheduled_date) {
        const date = new Date(data.scheduled_date);
        if (data.scheduled_time) {
          const [hours, minutes] = data.scheduled_time.split(':').map(Number);
          date.setHours(hours, minutes, 0, 0);
        }
        scheduledPickupAt = date.toISOString();
      }

      const orderCode = await generateOrderCode();
      const hasDriver = !!data.driver_id;

      const { error } = await supabase.from('stops').insert({
        pickup_address: data.pickup_address,
        pickup_lat: data.pickup_lat,
        pickup_lng: data.pickup_lng,
        delivery_address: data.delivery_address,
        delivery_lat: data.delivery_lat,
        delivery_lng: data.delivery_lng,
        client_name: data.client_name,
        client_phone: data.client_phone || null,
        client_notes: data.client_notes || null,
        driver_id: data.driver_id || null,
        status: hasDriver ? 'assigned' : 'pending',
        distance_km: routeDistance,
        scheduled_pickup_at: scheduledPickupAt,
        order_code: orderCode,
      } as any);

      if (error) throw error;

      toast.success('Parada creada correctamente');
      form.reset();
      setPickupResolved(false);
      setDeliveryResolved(false);
      setRouteDistance(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error('Error al crear parada', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Nueva Parada
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Introduce las direcciones y pulsa buscar para localizarlas en el mapa.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="pickup_address" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" /> Dirección de recogida
              </FormLabel>
              <FormControl>
                <AddressInput
                  value={field.value} onChange={(val) => field.onChange(val)}
                  onResolved={(d) => handleAddressResolved('pickup', d)}
                  onClear={() => setPickupResolved(false)} resolved={pickupResolved}
                  placeholder="Ej: Carrer de Balmes 145, Barcelona"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="delivery_address" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-delivered" /> Dirección de entrega
              </FormLabel>
              <FormControl>
                <AddressInput
                  value={field.value} onChange={(val) => field.onChange(val)}
                  onResolved={(d) => handleAddressResolved('delivery', d)}
                  onClear={() => setDeliveryResolved(false)} resolved={deliveryResolved}
                  placeholder="Ej: Passeig de Gràcia 92, Barcelona"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="client_name" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><User className="w-4 h-4" /> Nombre del cliente</FormLabel>
              <FormControl><Input placeholder="Juan García" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="client_phone" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><Phone className="w-4 h-4" /> Teléfono (opcional)</FormLabel>
              <FormControl><Input placeholder="+34 612 345 678" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="client_notes" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><FileText className="w-4 h-4" /> Notas (opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Instrucciones especiales, código de portal, etc." className="resize-none" rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Scheduled Pickup Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="scheduled_date" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> Día de recogida
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar día</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single" selected={field.value} onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="scheduled_time" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><Clock className="w-4 h-4" /> Hora de recogida</FormLabel>
                <FormControl><Input type="time" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {routeDistance !== null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-primary font-bold">{adjustDistance(routeDistance)} km</span>
              <span className="font-medium">· {getDeliveryZone(routeDistance)}</span>
              {calculatingRoute && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          )}
          {calculatingRoute && routeDistance === null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Calculando ruta en coche...</span>
            </div>
          )}

          {/* Driver Assignment */}
          <FormField control={form.control} name="driver_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Asignar repartidor (opcional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>{driver.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creando...' : 'Crear parada'}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
