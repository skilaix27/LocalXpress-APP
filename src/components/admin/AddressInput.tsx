import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, CheckCircle2, X } from 'lucide-react';
import { useGooglePlaces, type PlaceDetails } from '@/hooks/useGooglePlaces';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onResolved: (details: PlaceDetails) => void;
  onClear: () => void;
  resolved: boolean;
  placeholder?: string;
}

export function AddressInput({
  value,
  onChange,
  onResolved,
  onClear,
  resolved,
  placeholder = 'Escribe una dirección...',
}: AddressInputProps) {
  const [open, setOpen] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState<string | null>(null);
  const { predictions, loading, detailsLoading, search, getDetails, clear } = useGooglePlaces();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    if (resolved) {
      setConfirmedAddress(null);
      onClear();
    }
    search(val);
    setOpen(true);
  };

  const handleSelect = async (placeId: string, mainText: string) => {
    setOpen(false);
    clear();
    onChange(mainText);

    const details = await getDetails(placeId);
    if (details) {
      onChange(details.formattedAddress);
      setConfirmedAddress(details.formattedAddress);
      onResolved(details);
    } else {
      toast.error('No se pudo obtener los detalles de la dirección');
    }
  };

  const handleClear = () => {
    onChange('');
    setConfirmedAddress(null);
    onClear();
    clear();
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (predictions.length > 0 && !resolved) setOpen(true);
          }}
          className={cn(
            'pr-16',
            resolved && 'border-primary/40 bg-primary/5'
          )}
          disabled={detailsLoading}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {(loading || detailsLoading) && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {resolved && !loading && !detailsLoading && (
            <>
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 rounded-full hover:bg-muted transition-colors"
                title="Cambiar dirección"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </>
          )}
          {!resolved && !loading && !detailsLoading && (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Confirmed address badge */}
      {resolved && confirmedAddress && (
        <p className="text-xs text-primary mt-1 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{confirmedAddress}</span>
        </p>
      )}

      {/* Google predictions dropdown */}
      {open && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-start gap-2.5 transition-colors border-b last:border-b-0 border-border/30"
              onClick={() => handleSelect(p.placeId, p.mainText)}
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{p.mainText}</p>
                <p className="text-xs text-muted-foreground truncate">{p.secondaryText}</p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 bg-muted/30 flex items-center justify-end">
            <span className="text-[10px] text-muted-foreground">Powered by Google</span>
          </div>
        </div>
      )}

      {open && !loading && value.length >= 3 && predictions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md p-3 text-sm text-muted-foreground text-center">
          No se encontraron resultados
        </div>
      )}
    </div>
  );
}
