import { variantCode } from '@/app/admin/products/_lib/shade';

/** Strip the trailing `@#RRGGBB` shade encoding used in order snapshots. */
export function displayVariant(variantName: string | null): string {
  if (!variantName) return '—';
  return (
    variantName
      .split(' · ')
      .map((part) => part.replace(/@#[0-9A-Fa-f]{6}$/, ''))
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

export function shadeLabel(shade: string | null | undefined): string | null {
  if (!shade) return null;
  return variantCode(shade);
}
