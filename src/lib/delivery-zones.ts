export function getDeliveryZone(distanceKm: number): string {
  // Add 0.15 km adjustment as requested
  const adjustedDistance = distanceKm + 0.15;
  
  if (adjustedDistance <= 2.5) return 'Zona 1';
  if (adjustedDistance <= 7) return 'Zona 2';
  if (adjustedDistance <= 15) return 'Zona 3';
  return 'Zona 3 + plus km';
}

export function adjustDistance(distanceKm: number): number {
  return Math.round((distanceKm + 0.15) * 100) / 100;
}

