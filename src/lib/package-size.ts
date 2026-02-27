import type { PackageSize } from './supabase-types';

export const PACKAGE_SIZE_LABELS: Record<PackageSize, string> = {
  small: '📦 Pequeño',
  medium: '📦 Mediano',
  large: '📦 Grande',
};

export function getPackageSizeLabel(size: PackageSize | null | undefined): string | null {
  if (!size) return null;
  return PACKAGE_SIZE_LABELS[size] ?? null;
}
