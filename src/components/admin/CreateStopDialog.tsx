import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Profile } from '@/lib/supabase-types';
import { MapPin, User, Phone, FileText } from 'lucide-react';

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
});

type StopFormData = z.infer<typeof stopSchema>;

// Barcelona sample coordinates for demo
const BARCELONA_LOCATIONS = [
  { address: 'Plaça Catalunya, Barcelona', lat: 41.3870, lng: 2.1700 },
  { address: 'La Rambla, 91, Barcelona', lat: 41.3797, lng: 2.1746 },
  { address: 'Passeig de Gràcia, 92, Barcelona', lat: 41.3954, lng: 2.1630 },
  { address: 'Carrer de Balmes, 145, Barcelona', lat: 41.3961, lng: 2.1513 },
  { address: 'Avinguda Diagonal, 211, Barcelona', lat: 41.3914, lng: 2.1556 },
  { address: 'Carrer de Mallorca, 401, Barcelona', lat: 41.4052, lng: 2.1749 },
  { address: 'Carrer de Provença, 261, Barcelona', lat: 41.3993, lng: 2.1620 },
  { address: 'Carrer d\'Aragó, 255, Barcelona', lat: 41.3909, lng: 2.1614 },
];

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
    },
  });

  const onSubmit = async (data: StopFormData) => {
    setLoading(true);
    
    try {
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
      });

      if (error) throw error;

      toast.success('Parada creada correctamente');
      form.reset();
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

  // Helper to set random Barcelona location
  const setRandomLocation = (type: 'pickup' | 'delivery') => {
    const loc = BARCELONA_LOCATIONS[Math.floor(Math.random() * BARCELONA_LOCATIONS.length)];
    if (type === 'pickup') {
      form.setValue('pickup_address', loc.address);
      form.setValue('pickup_lat', loc.lat);
      form.setValue('pickup_lng', loc.lng);
    } else {
      form.setValue('delivery_address', loc.address);
      form.setValue('delivery_lat', loc.lat);
      form.setValue('delivery_lng', loc.lng);
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
                      <Input placeholder="Ej: Carrer de Balmes, 145" {...field} />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setRandomLocation('pickup')}
                      >
                        Demo
                      </Button>
                    </div>
                  </FormControl>
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
                      <Input placeholder="Ej: Passeig de Gràcia, 92" {...field} />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => setRandomLocation('delivery')}
                      >
                        Demo
                      </Button>
                    </div>
                  </FormControl>
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
