import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to get a signed URL for a private storage file.
 * Supports both full public URLs (legacy) and file paths.
 */
export function useSignedUrl(bucket: string, urlOrPath: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!urlOrPath) {
      setSignedUrl(null);
      return;
    }

    let filePath = urlOrPath;

    // If it's a full URL (legacy), extract the path after /object/public/{bucket}/
    const publicMarker = `/object/public/${bucket}/`;
    const idx = urlOrPath.indexOf(publicMarker);
    if (idx !== -1) {
      filePath = urlOrPath.substring(idx + publicMarker.length);
    }

    let cancelled = false;

    supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600) // 1 hour
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      });

    return () => { cancelled = true; };
  }, [bucket, urlOrPath]);

  return signedUrl;
}
