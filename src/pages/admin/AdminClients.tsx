import { useState, useMemo } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { StopCard } from '@/components/admin/StopCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/pricing';
import type { ProfileWithRole, Stop } from '@/lib/supabase-types';
import {
  Store, Search, FileText, Phone, MapPin, CreditCard, Save, Package,
  Euro, Hash, ChevronRight,
} from 'lucide-react';

export default function AdminClients() {
  const { allUsers, allStops, loading, fetchData } = useAdminData();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ProfileWithRole | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const shops = useMemo(() => allUsers.filter(u => u.role === 'shop'), [allUsers]);

  const filtered = useMemo(() => {
    if (!search) return shops;
    const q = search.toLowerCase();
    return shops.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.shop_name?.toLowerCase().includes(q) ||
      s.nif?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  }, [shops, search]);

  const getClientStops = (clientId: string) =>
    allStops.filter(s => s.shop_id === clientId);

  const getClientTotal = (clientId: string) =>
    getClientStops(clientId).reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Store className="w-6 h-6" /> Clientes (Tiendas)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{shops.length} tiendas registradas</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, NIF o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10"><Store className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{shops.length}</p>
              <p className="text-xs text-muted-foreground">Total clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10"><Package className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{allStops.filter(s => shops.some(sh => sh.id === s.shop_id)).length}</p>
              <p className="text-xs text-muted-foreground">Total pedidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10"><Euro className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{formatPrice(shops.reduce((s, c) => s + getClientTotal(c.id), 0))}</p>
              <p className="text-xs text-muted-foreground">Facturación total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client list */}
      <div className="grid sm:grid-cols-2 gap-3">
        {filtered.map(client => {
          const clientStops = getClientStops(client.id);
          const total = clientStops.reduce((s, st) => s + (Number(st.price) || 0), 0);
          return (
            <Card
              key={client.id}
              className="cursor-pointer card-hover"
              onClick={() => { setSelectedClient(client); setDetailOpen(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{client.shop_name || client.full_name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {client.nif && <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> {client.nif}</span>}
                      {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {clientStops.length} pedidos</span>
                      <span className="flex items-center gap-1 text-primary font-semibold"><Euro className="w-3 h-3" /> {formatPrice(total)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No se encontraron clientes</CardContent></Card>
      )}

      {selectedClient && (
        <ClientDetailDialog
          client={selectedClient}
          stops={allStops}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}

// ─── Client Detail Dialog ───

function ClientDetailDialog({
  client, stops, open, onOpenChange, onUpdate,
}: {
  client: ProfileWithRole;
  stops: Stop[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    shop_name: client.shop_name || '',
    full_name: client.full_name,
    phone: client.phone || '',
    nif: client.nif || '',
    fiscal_address: client.fiscal_address || '',
    admin_notes: client.admin_notes || '',
  });

  const clientStops = useMemo(() => stops.filter(s => s.shop_id === client.id), [stops, client]);
  const totalRevenue = clientStops.reduce((s, st) => s + (Number(st.price) || 0), 0);
  const deliveredCount = clientStops.filter(s => s.status === 'delivered').length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        shop_name: form.shop_name || null,
        full_name: form.full_name,
        phone: form.phone || null,
        nif: form.nif || null,
        fiscal_address: form.fiscal_address || null,
        admin_notes: form.admin_notes || null,
      } as any).eq('id', client.id);
      if (error) throw error;
      toast.success('Cliente actualizado');
      onUpdate();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Error al guardar', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          {client.shop_name || client.full_name}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Ficha completa del cliente</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <Tabs defaultValue="edit" className="mt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Datos del cliente</TabsTrigger>
          <TabsTrigger value="orders">Pedidos ({clientStops.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-4 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">{clientStops.length}</p>
              <p className="text-[10px] text-muted-foreground">Total pedidos</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">{deliveredCount}</p>
              <p className="text-[10px] text-muted-foreground">Entregados</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-lg font-bold text-primary">{formatPrice(totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">Facturado</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Store className="w-3 h-3" /> Nombre comercial</Label>
              <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre contacto</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><CreditCard className="w-3 h-3" /> NIF/CIF</Label>
              <Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} placeholder="B12345678" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección fiscal</Label>
              <Input value={form.fiscal_address} onChange={(e) => setForm({ ...form, fiscal_address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Notas internas</Label>
              <Textarea value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })} rows={2} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {clientStops.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay pedidos</p>
            ) : clientStops.map(stop => (
              <div key={stop.id} className="p-3 rounded-lg border text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{stop.order_code || stop.client_name}</span>
                  <Badge variant="secondary" className="text-xs">{stop.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{stop.delivery_address}</p>
                {stop.price != null && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-primary">{formatPrice(Number(stop.price))}</span>
                    <span className="text-muted-foreground">Repartidor: {formatPrice(Number(stop.price_driver))}</span>
                    <span className="text-muted-foreground">Empresa: {formatPrice(Number(stop.price_company))}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </ResponsiveDialog>
  );
}
