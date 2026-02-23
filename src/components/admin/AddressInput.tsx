import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, CheckCircle2, Navigation } from 'lucide-react';
import { useAddressAutocomplete, type AddressSuggestion } from '@/hooks/useAddressAutocomplete';
import { cn } from '@/lib/utils';

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  resolved: boolean;
  placeholder?: string;
  resolvedLabel?: string;
}

export function AddressInput({
  value,
  onChange,
  onSelect,
  resolved,
  placeholder = 'Escribe una dirección...',
  resolvedLabel,
}: AddressInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<string | null>(null);
  const { suggestions, loading, search, clear } = useAddressAutocomplete();
  const containerRef = useRef<HTMLDivElement>(null);

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
    setSelectedDisplay(null);
    search(val);
    setOpen(true);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.shortName);
    setSelectedDisplay(suggestion.displayName);
    onSelect(suggestion);
    setOpen(false);
    clear();
  };

  // Parse display name into structured parts
  const parseAddress = (displayName: string) => {
    const parts = displayName.split(',').map(p => p.trim());
    const street = parts.slice(0, 2).join(', ');
    const area = parts.slice(2, 4).join(', ');
    const rest = parts.slice(4).join(', ');
    return { street, area, rest };
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 && !resolved) setOpen(true);
          }}
          className={cn(
            'pr-9',
            resolved && 'border-primary/40 bg-primary/5'
          )}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : resolved ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Confirmed address detail */}
      {resolved && selectedDisplay && (
        <div className="mt-1.5 p-2 rounded-md bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Navigation className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <div className="text-xs leading-relaxed">
              <span className="font-medium text-foreground">
                {parseAddress(selectedDisplay).street}
              </span>
              <span className="text-muted-foreground">
                {' · '}{parseAddress(selectedDisplay).area}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-[220px] overflow-y-auto">
          <div className="p-1.5">
            {suggestions.map((s, i) => {
              const parsed = parseAddress(s.displayName);
              return (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-accent flex items-start gap-2.5 transition-colors"
                  onClick={() => handleSelect(s)}
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{parsed.street}</p>
                    <p className="text-xs text-muted-foreground truncate">{parsed.area}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && !loading && value.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md p-3 text-sm text-muted-foreground text-center">
          No se encontraron resultados. Prueba con más detalle.
        </div>
      )}
    </div>
  );
}
