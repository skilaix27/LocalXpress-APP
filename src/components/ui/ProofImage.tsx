import { getPhotoUrl } from '@/lib/api';

interface ProofImageProps {
  proofPhotoUrl: string | null | undefined;
  className?: string;
}

export function ProofImage({
  proofPhotoUrl,
  className = 'w-full rounded-lg border max-h-[50vh] object-contain bg-muted/30',
}: ProofImageProps) {
  const url = getPhotoUrl(proofPhotoUrl);
  if (!url) return null;

  return (
    <img
      src={url}
      alt="Prueba de entrega"
      className={className}
      crossOrigin="anonymous"
      onError={(e) => {
        // Hide broken image icon instead of showing a broken placeholder
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
