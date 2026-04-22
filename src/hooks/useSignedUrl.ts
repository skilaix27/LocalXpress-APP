import { getPhotoUrl } from '@/lib/api';

// Returns the direct URL for a proof photo stored on the custom backend.
// The `bucket` parameter is kept for interface compatibility but is unused.
export function useSignedUrl(_bucket: string, urlOrPath: string | null | undefined): string | null {
  return getPhotoUrl(urlOrPath);
}
