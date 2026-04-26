import { useState, useMemo } from 'react';
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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { stopsApi } from '@/lib/api';
import { toast } from 'sonner';
import type { Profile, ProfileWithRole } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText, Loader2, CalendarIcon, Clock, Package, Store, Check, ChevronsUpDown } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRouteDistance } from '@/hooks/useRouteDistance';
import { AddressInput } from '@/components/admin/AddressInput';
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
  shop_name: z.string().min(1, 'Nombre de tienda requerido'),
  driver_id: z.string().optional(),
  scheduled_date: z.date().optional(),
  scheduled_time: z.string().optional(),
  package_size: z.enum(['small', 'medium', 'large']).optional(),
});

type StopFormData = z.infer<typeof stopSchema>;

interface CreateStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: Profile[];
  shops: ProfileWithRole[];
  onSuccess?: () => void;
}

export function CreateStopDialog({ open, onOpenChange, drivers, shops, onSuccess }: CreateStopDialogProps) {
  const [loading, setLoading] = useState(false);
  const [pickupResolved, setPickupResolved] = useState(false);
  const [shopPopoverOpen, setShopPopoverOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [deliveryResolved, setDeliveryResolved] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const { calculateDistance, loading: calculatingRoute } = useRouteDistance();

  const form = useForm<StopFormData>({
    resolver: zodResolver(stopSchema),
    defaultValues: {
      pickup_address: '', pickup_lat: 41.3851, pickup_lng: 2.1734,
      delivery_address: '', delivery_lat: 41.3920, delivery_lng: 2.1650,
      client_name: '', client_phone: '', client_notes: '',
      shop_name: '',
      driver_id: '', scheduled_date: undefined, scheduled_time: '',
      package_size: undefined,
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

      const hasDriver = !!data.driver_id;

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
        driver_id: data.driver_id || null,
        status: hasDriver ? 'assigned' : 'pending',
        distance_km: routeDistance,
        scheduled_pickup_at: scheduledPickupAt,
        package_size: data.package_size || null,
        shop_name: data.shop_name,
        shop_id: selectedShopId || null,
      });

      toast.success('Parada creada correctamente');
      form.reset();
      setPickupResolved(false);
      setDeliveryResolved(false);
      setRouteDistance(null);
      setSelectedShopId(null);
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

          <FormField control={form.control} name="shop_name" render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="flex items-center gap-2"><Store className="w-4 h-4" /> Tienda</FormLabel>
              <Popover open={shopPopoverOpen} onOpenChange={setShopPopoverOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                    >
                      {field.value || "Seleccionar o escribir tienda"}
                      <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar o escribir tienda..."
                      onValueChange={(val) => {
                        field.onChange(val);
                        setSelectedShopId(null);
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {field.value ? (
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded cursor-pointer"
                            onClick={() => {
                              setSelectedShopId(null);
                              setShopPopoverOpen(false);
                            }}
                          >
                            Usar "<span className="font-semibold">{field.value}</span>" como nombre
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm">Escribe el nombre de la tienda</span>
                        )}
                      </CommandEmpty>
                      <CommandGroup heading="Tiendas registradas">
                        {shops.map((shop) => (
                          <CommandItem
                            key={shop.id}
                            value={shop.shop_name || shop.full_name}
                            onSelect={() => {
                              field.onChange(shop.shop_name || shop.full_name);
                              setSelectedShopId(shop.id);
                              setShopPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedShopId === shop.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{shop.shop_name || shop.full_name}</span>
                              {shop.shop_name && <span className="text-xs text-muted-foreground">{shop.full_name}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

          {/* Package size */}
          <FormField control={form.control} name="package_size" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Package className="w-4 h-4" /> Tamaño del paquete (opcional)
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
                      htmlFor={`admin-size-${size.value}`}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                        field.value === size.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/40'
                      }`}
                    >
                      <RadioGroupItem value={size.value} id={`admin-size-${size.value}`} className="sr-only" />
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
                {calculatingRoute && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            );
          })()}
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
