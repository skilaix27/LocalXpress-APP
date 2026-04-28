import { useState } from 'react';
import { Image } from 'lucide-react';
import { getPhotoUrl } from '@/lib/api';

interface ProofImageProps {
  proofPhotoUrl: string | null | undefined;
  isArchived?: boolean;
  className?: string;
}

export function ProofImage({
  proofPhotoUrl,
  isArchived = false,
  className = 'w-full rounded-lg border max-h-[50vh] object-contain bg-muted/30',
}: ProofImageProps) {
  const [deleted, setDeleted] = useState(false);
  const url = getPhotoUrl(proofPhotoUrl);

  if (!url || deleted || isArchived) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
        <Image className="w-4 h-4 shrink-0" />
        {(deleted || isArchived) ? 'Foto eliminada por política de retención' : 'Sin foto de entrega'}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Prueba de entrega"
      className={className}
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => setDeleted(true)}
    />
  );
}
