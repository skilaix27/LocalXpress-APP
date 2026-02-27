import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

interface PrivacyConsentDialogProps {
  open: boolean;
  profileId: string;
  onAccepted: () => void;
}

export function PrivacyConsentDialog({ open, profileId, onAccepted }: PrivacyConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ privacy_accepted_at: new Date().toISOString() } as any)
        .eq('id', profileId);

      if (error) throw error;
      toast.success('Política de privacidad aceptada');
      onAccepted();
    } catch {
      toast.error('Error al guardar el consentimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <DialogTitle>Política de Privacidad y Cookies</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 max-h-[50dvh] overflow-y-auto pr-4">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed pb-8">
            <p className="font-semibold text-foreground">
              Antes de continuar, es necesario que leas y aceptes nuestra política de privacidad y cookies conforme al Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
            </p>

            <section>
              <h3 className="font-semibold text-foreground mb-1">1. Responsable del tratamiento</h3>
              <p>
                El responsable del tratamiento de los datos personales es LocalXpress. Los datos de contacto del responsable están disponibles a través de la dirección de correo electrónico del administrador de la plataforma.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">2. Finalidad del tratamiento</h3>
              <p>
                Los datos personales recogidos se tratarán <strong>exclusivamente</strong> con las siguientes finalidades:
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Gestión operativa del servicio de reparto y entregas.</li>
                <li>Asignación de rutas y paradas a los repartidores.</li>
                <li>Coordinación logística entre tiendas, repartidores y administradores.</li>
                <li>Geolocalización durante la jornada laboral para optimizar las rutas de entrega.</li>
                <li>Registro de pruebas de entrega (fotografías) como justificante del servicio.</li>
                <li>Comunicaciones internas relacionadas con el servicio.</li>
              </ul>
              <p className="mt-2">
                <strong>En ningún caso</strong> los datos serán utilizados con fines comerciales, publicitarios o de marketing, ni serán cedidos a terceros ajenos a la prestación del servicio.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">3. Base jurídica del tratamiento</h3>
              <p>
                La base legal para el tratamiento de los datos es la ejecución de la relación contractual o laboral existente entre el usuario y la empresa (art. 6.1.b RGPD), así como el consentimiento explícito del interesado (art. 6.1.a RGPD) otorgado mediante la aceptación de esta política.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">4. Datos tratados</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nombre completo y datos de contacto (teléfono, email).</li>
                <li>Datos de geolocalización durante la jornada laboral.</li>
                <li>Fotografías de prueba de entrega.</li>
                <li>Historial de entregas y rutas realizadas.</li>
                <li>Datos de acceso a la plataforma (credenciales de usuario).</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">5. Conservación de los datos</h3>
              <p>
                Los datos personales se conservarán durante el tiempo necesario para cumplir con la finalidad para la que fueron recogidos. Los datos de geolocalización se eliminan automáticamente transcurridos 30 días. El resto de datos se conservarán mientras dure la relación laboral o contractual y, posteriormente, durante los plazos legales establecidos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">6. Cesión de datos a terceros</h3>
              <p>
                Los datos <strong>no serán cedidos a terceros</strong>, salvo obligación legal o requerimiento de las autoridades competentes. Los datos se almacenan en servidores seguros con las medidas técnicas y organizativas adecuadas.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">7. Derechos del interesado</h3>
              <p>
                De conformidad con el RGPD, el usuario tiene derecho a:
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li><strong>Acceso:</strong> conocer qué datos personales se están tratando.</li>
                <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos.</li>
                <li><strong>Supresión:</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
                <li><strong>Limitación:</strong> solicitar la limitación del tratamiento en determinados supuestos.</li>
                <li><strong>Portabilidad:</strong> recibir sus datos en un formato estructurado y de uso común.</li>
                <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos en determinadas circunstancias.</li>
              </ul>
              <p className="mt-2">
                Para ejercer estos derechos, el usuario podrá contactar con el administrador de la plataforma. Asimismo, tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.aepd.es</a>.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">8. Cookies</h3>
              <p>
                Esta plataforma utiliza <strong>cookies técnicas y de sesión</strong> estrictamente necesarias para el funcionamiento del servicio y la autenticación del usuario. No se utilizan cookies analíticas, publicitarias ni de seguimiento de terceros. Las cookies de sesión se eliminan al cerrar la sesión o al expirar automáticamente.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-1">9. Medidas de seguridad</h3>
              <p>
                Se han adoptado las medidas técnicas y organizativas necesarias para garantizar la seguridad de los datos personales, incluyendo cifrado en tránsito y en reposo, control de acceso basado en roles y políticas de seguridad a nivel de fila en la base de datos.
              </p>
            </section>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-2 border-t">
          <Checkbox
            id="privacy-accept"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
          />
          <label htmlFor="privacy-accept" className="text-sm leading-snug cursor-pointer">
            He leído y acepto la Política de Privacidad y Cookies. Entiendo que mis datos se usarán exclusivamente para la gestión del servicio de reparto.
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleAccept} disabled={!accepted || loading} className="w-full">
            {loading ? 'Guardando...' : 'Aceptar y continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
