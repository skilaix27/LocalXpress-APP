export function getDeliveryZone(distanceKm: number): string {
  if (distanceKm <= 2.5) return 'Zona 1';
  if (distanceKm <= 7) return 'Zona 2';
  if (distanceKm <= 15) return 'Zona 3';
  return 'Zona 3 + plus km';
}
