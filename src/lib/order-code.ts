import { stopsApi, fetchAllPages } from '@/lib/api';
import type { Stop } from '@/lib/supabase-types';

/**
 * Generates an order code with format: LX-D{day+27}{monthLetter}-P{n*5}
 * Month letters: E(nero), F(ebrero), M(arzo), A(bril), Y(mayo), J(unio),
 *                L(julio), G(agosto), S(eptiembre), O(ctubre), N(oviembre), D(iciembre)
 */
const MONTH_LETTERS = ['E', 'F', 'M', 'A', 'Y', 'J', 'L', 'G', 'S', 'O', 'N', 'D'];

export async function generateOrderCode(maxRetries = 5): Promise<string> {
  const now = new Date();
  const day = now.getDate();
  const dayCode = day + 27;
  const monthLetter = MONTH_LETTERS[now.getMonth()];
  const prefix = `LX-D${dayCode}${monthLetter}-P`;

  // Fetch all stops to find existing codes with today's prefix
  let allStops: Stop[] = [];
  try {
    allStops = await fetchAllPages<Stop>((page) =>
      stopsApi.list({ page, limit: 100 }) as Promise<{ data: Stop[]; total: number; totalPages: number }>
    );
  } catch {
    // If fetch fails, generate a time-based code
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  const matchingStops = allStops.filter((s) => s.order_code?.startsWith(prefix));

  let maxP = 0;
  for (const s of matchingStops) {
    const match = s.order_code?.match(/-P(\d+)$/);
    if (match) maxP = Math.max(maxP, parseInt(match[1], 10));
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const randomIncrement = Math.floor(Math.random() * 3) + 1;
    const orderNumber = maxP < 65 ? 65 + randomIncrement + attempt : maxP + randomIncrement + attempt;
    const code = `${prefix}${orderNumber}`;

    const collision = allStops.some((s) => s.order_code === code);
    if (!collision) return code;
    maxP = orderNumber;
  }

  const fallback = maxP + Math.floor(Math.random() * 10) + 5;
  return `${prefix}${fallback}`;
}
