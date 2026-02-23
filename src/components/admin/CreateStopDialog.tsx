import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Profile } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Loader2, Search, CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGeocoding } from '@/hooks/useGeocoding';
import { useRouteDistance } from '@/hooks/useRouteDistance';
import { getDeliveryZone } from '@/lib/delivery-zones';

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

export function CreateStopDialog({
  open,
  onOpenChange,
  drivers,
  onSuccess,
}: CreateStopDialogProps) {
  const [loading, setLoading] = useState(false);
  const [pickupResolved, setPickupResolved] = useState(false);
  const [deliveryResolved, setDeliveryResolved] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const { geocodeAddress, loading: geocoding } = useGeocoding();
  const { calculateDistance, loading: calculatingRoute } = useRouteDistance();

  const form = useForm<StopFormData>({
    resolver: zodResolver(stopSchema),
    defaultValues: {
      pickup_address: '',
      pickup_lat: 41.3851,
      pickup_lng: 2.1734,
      delivery_address: '',
      delivery_lat: 41.3920,
      delivery_lng: 2.1650,
      client_name: '',
      client_phone: '',
      client_notes: '',
      driver_id: '',
      scheduled_date: undefined,
      scheduled_time: '',
    },
  });

  const resolveAddress = async (type: 'pickup' | 'delivery') => {
    const address = form.getValues(type === 'pickup' ? 'pickup_address' : 'delivery_address');
    if (!address) {
      toast.error('Introduce una dirección primero');
      return;
    }

    const result = await geocodeAddress(address);
    if (result) {
      if (type === 'pickup') {
        form.setValue('pickup_lat', result.lat);
        form.setValue('pickup_lng', result.lng);
        setPickupResolved(true);
      } else {
        form.setValue('delivery_lat', result.lat);
        form.setValue('delivery_lng', result.lng);
        setDeliveryResolved(true);
      }
      toast.success(`Dirección localizada`, { description: result.displayName.split(',').slice(0, 3).join(',') });
      
      // Auto-calculate route distance when both addresses are resolved
      const pResolved = type === 'pickup' ? true : pickupResolved;
      const dResolved = type === 'delivery' ? true : deliveryResolved;
      if (pResolved && dResolved) {
        const pLat = type === 'pickup' ? result.lat : form.getValues('pickup_lat');
        const pLng = type === 'pickup' ? result.lng : form.getValues('pickup_lng');
        const dLat = type === 'delivery' ? result.lat : form.getValues('delivery_lat');
        const dLng = type === 'delivery' ? result.lng : form.getValues('delivery_lng');
        const route = await calculateDistance(pLat, pLng, dLat, dLng);
        if (route) {
          setRouteDistance(route.distanceKm);
        }
      }
    } else {
      toast.error('No se encontró la dirección', { description: 'Intenta con más detalle, ej: "Carrer de Balmes 145, Barcelona"' });
    }
  };

  const onSubmit = async (data: StopFormData) => {
    if (!pickupResolved || !deliveryResolved) {
      toast.error('Busca las direcciones primero', {
        description: 'Pulsa el botón de búsqueda para localizar las direcciones en el mapa',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Build scheduled_pickup_at timestamp
      let scheduledPickupAt: string | null = null;
      if (data.scheduled_date) {
        const date = new Date(data.scheduled_date);
        if (data.scheduled_time) {
          const [hours, minutes] = data.scheduled_time.split(':').map(Number);
          date.setHours(hours, minutes, 0, 0);
        }
        scheduledPickupAt = date.toISOString();
      }

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
        distance_km: routeDistance,
        scheduled_pickup_at: scheduledPickupAt,
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
      toast.error('Error al crear parada', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Nueva Parada
          </DialogTitle>
          <DialogDescription>
            Introduce las direcciones y pulsa buscar para localizarlas en el mapa.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Pickup Address */}
            <FormField
              control={form.control}
              name="pickup_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Dirección de recogida
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Ej: Carrer de Balmes 145, Barcelona" 
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          setPickupResolved(false);
                        }}
                      />
                      <Button 
                        type="button" 
                        variant={pickupResolved ? "default" : "outline"}
                        size="icon"
                        onClick={() => resolveAddress('pickup')}
                        disabled={geocoding}
                        title="Buscar dirección"
                      >
                        {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  {pickupResolved && (
                    <p className="text-xs text-status-delivered">✓ Dirección localizada en el mapa</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Delivery Address */}
            <FormField
              control={form.control}
              name="delivery_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-status-delivered" />
                    Dirección de entrega
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Ej: Passeig de Gràcia 92, Barcelona" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setDeliveryResolved(false);
                        }}
                      />
                      <Button 
                        type="button" 
                        variant={deliveryResolved ? "default" : "outline"}
                        size="icon"
                        onClick={() => resolveAddress('delivery')}
                        disabled={geocoding}
                        title="Buscar dirección"
                      >
                        {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  {deliveryResolved && (
                    <p className="text-xs text-status-delivered">✓ Dirección localizada en el mapa</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client Name */}
            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nombre del cliente
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Juan García" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client Phone */}
            <FormField
              control={form.control}
              name="client_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Teléfono (opcional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="+34 612 345 678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client Notes */}
            <FormField
              control={form.control}
              name="client_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notas (opcional)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Instrucciones especiales, código de portal, etc."
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scheduled Pickup Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Día de recogida
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: es })
                            ) : (
                              <span>Seleccionar día</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Hora de recogida
                    </FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {routeDistance !== null && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-primary font-bold">{routeDistance} km</span>
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
            <FormField
              control={form.control}
              name="driver_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asignar repartidor (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creando...' : 'Crear parada'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
