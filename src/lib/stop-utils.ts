import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PickupFields {
  scheduled_time?: string | null;
  scheduled_pickup_at?: string | null;
}

/**
 * Returns the correct human-readable pickup time for a stop.
 * Prefers the stored text label (scheduled_time) over a formatted timestamp.
 * Falls back to null if neither field is present.
 */
export function getPickupDisplay(stop: PickupFields, dateFormat = "d MMM · HH:mm"): string | null {
  if (stop.scheduled_time) return stop.scheduled_time;
  if (stop.scheduled_pickup_at) {
    try {
      return format(new Date(stop.scheduled_pickup_at), dateFormat, { locale: es });
    } catch {
      return stop.scheduled_pickup_at;
    }
  }
  return null;
}
