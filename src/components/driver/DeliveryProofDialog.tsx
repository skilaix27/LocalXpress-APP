import { useState, useRef, useCallback, forwardRef } from 'react';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Stop } from '@/lib/supabase-types';
import { Camera, Upload, X, CheckCircle, Loader2 } from 'lucide-react';

interface DeliveryProofDialogProps {
  stop: Stop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const MAX_DIMENSION = 1200; // px — enough for proof, saves ~80% space
const JPEG_QUALITY = 0.6;  // 60% quality — good balance size/clarity

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if larger than MAX_DIMENSION
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export const DeliveryProofDialog = forwardRef<HTMLDivElement, DeliveryProofDialogProps>(function DeliveryProofDialog({ stop, open, onOpenChange, onSuccess }, _ref) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('La imagen no puede superar 10MB'); return; }

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error('Error al procesar la imagen');
    } finally {
      setCompressing(false);
    }
  }, []);

  const clearPhoto = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!photo) { toast.error('Debes adjuntar una foto de la entrega'); return; }
    setUploading(true);
    try {
      const fileName = `${stop.id}-${Date.now()}.jpg`;
      const filePath = `${stop.driver_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('delivery-proofs')
        .upload(filePath, photo, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('stops')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          proof_photo_url: filePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stop.id);
      if (updateError) throw updateError;

      toast.success('¡Entrega completada!', { description: `Paquete entregado a ${stop.client_name}` });
      clearPhoto();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error('Error al completar la entrega', { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-status-delivered" />
          Confirmar entrega
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Adjunta una foto como prueba de entrega para {stop.client_name}.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="space-y-4">
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full rounded-lg border max-h-[50vh] object-contain bg-muted/30" />
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={clearPhoto}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : compressing ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Optimizando imagen…</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-primary/5 transition-colors active:scale-95">
              <Camera className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">Cámara</span>
            </button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <button onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg hover:border-primary hover:bg-primary/5 transition-colors active:scale-95">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">Galería</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!photo || uploading}
          className="w-full h-12 text-base gap-2 bg-status-delivered hover:bg-status-delivered/90 text-white">
          {uploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Subiendo...</>
          ) : (
            <><CheckCircle className="w-5 h-5" /> Confirmar entrega</>
          )}
        </Button>
      </div>
    </ResponsiveDialog>
  );
});
