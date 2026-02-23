import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';
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
    search(val);
    setOpen(true);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.shortName);
    onSelect(suggestion);
    setOpen(false);
    clear();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          className={cn(
            'pr-9',
            resolved && 'border-green-500/50 bg-green-500/5'
          )}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : resolved ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {resolved && resolvedLabel && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {resolvedLabel}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[200px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-start gap-2 border-b last:border-b-0 border-border/50 transition-colors"
              onClick={() => handleSelect(s)}
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
              <span className="text-foreground leading-tight">{s.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && value.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground text-center">
          No se encontraron resultados
        </div>
      )}
    </div>
  );
}
