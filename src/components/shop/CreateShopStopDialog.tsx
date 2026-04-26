import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { stopsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MapPin, User, Phone, FileText, Loader2, Store, Clock, Navigation, Package, CalendarIcon } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useRouteDistance } from '@/hooks/useRouteDistance';
import { AddressInput } from '@/components/admin/AddressInput';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PlaceDetails } from '@/hooks/useGooglePlaces';
import { getDeliveryZone, adjustDistance, getDeliveryPrice } from '@/lib/delivery-zones';

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
  scheduled_pickup_time: z.string().min(1, 'Hora de recogida requerida'),
  scheduled_pickup_date: z.date({ required_error: 'Fecha de recogida requerida' }),
  package_size: z.enum(['small', 'medium', 'large'], { required_error: 'Selecciona un tamaño' }),
});

type StopFormData = z.infer<typeof stopSchema>;

interface CreateShopStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateShopStopDialog({ open, onOpenChange, onSuccess }: CreateShopStopDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pickupResolved, setPickupResolved] = useState(false);
  const [deliveryResolved, setDeliveryResolved] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [useDefaultPickup, setUseDefaultPickup] = useState(true);
  const { calculateDistance, loading: calculatingRoute } = useRouteDistance();

  const hasDefaultPickup = !!(profile?.default_pickup_address && profile?.default_pickup_lat && profile?.default_pickup_lng);

  const form = useForm<StopFormData>({
    resolver: zodResolver(stopSchema),
    defaultValues: {
      pickup_address: '', pickup_lat: 41.3851, pickup_lng: 2.1734,
      delivery_address: '', delivery_lat: 41.3920, delivery_lng: 2.1650,
      client_name: '', client_phone: '', client_notes: '',
      scheduled_pickup_time: '',
      scheduled_pickup_date: new Date(),
      package_size: undefined as any,
    },
  });

  useEffect(() => {
    if (open && hasDefaultPickup && useDefaultPickup) {
      form.setValue('pickup_address', profile!.default_pickup_address!);
      form.setValue('pickup_lat', profile!.default_pickup_lat!);
      form.setValue('pickup_lng', profile!.default_pickup_lng!);
      setPickupResolved(true);
    }
  }, [open, hasDefaultPickup, useDefaultPickup]);

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

  useEffect(() => {
    if (pickupResolved && deliveryResolved && routeDistance === null) {
      const pLat = form.getValues('pickup_lat');
      const pLng = form.getValues('pickup_lng');
      const dLat = form.getValues('delivery_lat');
      const dLng = form.getValues('delivery_lng');
      calculateDistance(pLat, pLng, dLat, dLng).then(route => {
        if (route) setRouteDistance(route.distanceKm);
      });
    }
  }, [deliveryResolved]);

  const onSubmit = async (data: StopFormData) => {
    if (!pickupResolved || !deliveryResolved) {
      toast.error('Selecciona las direcciones primero');
      return;
    }
    if (!profile) return;

    setLoading(true);
    try {
      // Build scheduled_pickup_at from date + time inputs
      const pickupDate = data.scheduled_pickup_date;
      const [hours, minutes] = data.scheduled_pickup_time.split(':').map(Number);
      const scheduledDate = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate(), hours, minutes);

      await stopsApi.create({
        pickup_address: data.pickup_address,
        pickup_lat: data.pickup_lat,
        pickup_lng: data.pickup_lng,
        delivery_address: data.delivery_address,
        delivery_lat: data.delivery_lat,
        delivery_lng: data.delivery_lng,
        client_name: data.client_name,
        client_phone: data.client_phone || null,
        client_notes: data.client_notes || null,
        distance_km: routeDistance,
        shop_id: profile.id,
        shop_name: profile.shop_name || profile.full_name,
        scheduled_pickup_at: scheduledDate.toISOString(),
        package_size: data.package_size,
      });

      toast.success('Pedido creado correctamente');
      form.reset();
      setPickupResolved(false);
      setDeliveryResolved(false);
      setRouteDistance(null);
      setUseDefaultPickup(true);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error('Error al crear pedido', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToCustomPickup = () => {
    setUseDefaultPickup(false);
    setPickupResolved(false);
    setRouteDistance(null);
    form.setValue('pickup_address', '');
    form.setValue('pickup_lat', 41.3851);
    form.setValue('pickup_lng', 2.1734);
  };

  const handleSwitchToDefaultPickup = () => {
    if (hasDefaultPickup) {
      setUseDefaultPickup(true);
      form.setValue('pickup_address', profile!.default_pickup_address!);
      form.setValue('pickup_lat', profile!.default_pickup_lat!);
      form.setValue('pickup_lng', profile!.default_pickup_lng!);
      setPickupResolved(true);
      setRouteDistance(null);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Nuevo Pedido
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Introduce las direcciones de recogida y entrega para tu pedido.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Pickup address - segmented toggle */}
          <div className="space-y-3">
            <FormLabel className="flex items-center gap-2 text-sm font-semibold">
              <Store className="w-4 h-4 text-primary" /> Dirección de recogida
            </FormLabel>
            
            {hasDefaultPickup && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
                <button
                  type="button"
                  onClick={handleSwitchToDefaultPickup}
                  className={`text-xs font-medium py-2 px-3 rounded-md transition-all ${useDefaultPickup ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  📍 Mi tienda
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToCustomPickup}
                  className={`text-xs font-medium py-2 px-3 rounded-md transition-all ${!useDefaultPickup ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Navigation className="w-3 h-3 inline mr-1" /> Otra dirección
                </button>
              </div>
            )}

            <FormField control={form.control} name="pickup_address" render={({ field }) => (
              <FormItem>
                <FormControl>
                  {hasDefaultPickup && useDefaultPickup ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Store className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm break-words">{profile!.default_pickup_address}</p>
                    </div>
                  ) : (
                    <AddressInput
                      value={field.value} onChange={field.onChange}
                      onResolved={(d) => handleAddressResolved('pickup', d)}
                      onClear={() => setPickupResolved(false)} resolved={pickupResolved}
                      placeholder="Ej: Carrer de Balmes 145, Barcelona"
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="delivery_address" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-delivered" /> Dirección de entrega
              </FormLabel>
              <FormControl>
                <AddressInput
                  value={field.value} onChange={field.onChange}
                  onResolved={(d) => handleAddressResolved('delivery', d)}
                  onClear={() => setDeliveryResolved(false)} resolved={deliveryResolved}
                  placeholder="Ej: Passeig de Gràcia 92, Barcelona"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Scheduled pickup date + time */}
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="scheduled_pickup_date" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" /> Fecha
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
                        {field.value ? format(field.value, "d MMM yyyy", { locale: es }) : <span>Seleccionar</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="scheduled_pickup_time" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Hora
                </FormLabel>
                <FormControl>
                  <Input type="time" {...field} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

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

          {/* Package size */}
          <FormField control={form.control} name="package_size" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Package className="w-4 h-4" /> Tamaño del paquete
              </FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'small', label: '📦 Pequeño', desc: 'Mochila o baúl de transporte' },
                    { value: 'medium', label: '📦 Mediano', desc: 'Baúl grande de moto' },
                    { value: 'large', label: '📦 Grande', desc: 'Coche o furgoneta requerido' },
                  ].map((size) => (
                    <Label
                      key={size.value}
                      htmlFor={`size-${size.value}`}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                        field.value === size.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/40'
                      }`}
                    >
                      <RadioGroupItem value={size.value} id={`size-${size.value}`} className="sr-only" />
                      <span className="text-sm font-medium">{size.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{size.desc}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {routeDistance !== null && (() => {
            const price = getDeliveryPrice(routeDistance);
            return (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-primary font-bold">{adjustDistance(routeDistance)} km</span>
                <span className="font-medium">· {getDeliveryZone(routeDistance)}</span>
                {price != null && <span className="font-bold text-primary">· {price} €</span>}
              </div>
            );
          })()}
          {calculatingRoute && routeDistance === null && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Calculando ruta...</span>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creando...' : 'Crear pedido'}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
