import { isSameDay } from 'date-fns';

/**
 * Determines if a stop is scheduled for today or has no scheduled date (immediate).
 * Stops without scheduled_pickup_at are considered "today" stops.
 */
export function isStopForToday(stop: { scheduled_pickup_at: string | null }): boolean {
  if (!stop.scheduled_pickup_at) return true;
  return isSameDay(new Date(stop.scheduled_pickup_at), new Date());
}
