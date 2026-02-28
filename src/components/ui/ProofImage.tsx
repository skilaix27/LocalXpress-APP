import { useSignedUrl } from '@/hooks/useSignedUrl';

interface ProofImageProps {
  proofPhotoUrl: string | null;
  className?: string;
}

export function ProofImage({ proofPhotoUrl, className = "w-full rounded-lg border max-h-[50vh] object-contain bg-muted/30" }: ProofImageProps) {
  const signedUrl = useSignedUrl('delivery-proofs', proofPhotoUrl);

  if (!signedUrl) return null;

  return (
    <img
      src={signedUrl}
      alt="Prueba de entrega"
      className={className}
    />
  );
}
