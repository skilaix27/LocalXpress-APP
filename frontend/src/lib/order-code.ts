import { supabase } from '@/integrations/supabase/client';

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

  // Get the highest P number from ALL stops with today's prefix
  const { data: matchingStops } = await supabase
    .from('stops')
    .select('order_code')
    .like('order_code', `${prefix}%`);

  let maxP = 0;
  if (matchingStops) {
    for (const s of matchingStops) {
      const match = s.order_code?.match(/-P(\d+)$/);
      if (match) maxP = Math.max(maxP, parseInt(match[1], 10));
    }
  }

  // Start above 65, then add random increment (1-3)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const randomIncrement = Math.floor(Math.random() * 3) + 1;
    const orderNumber = maxP < 65 ? 65 + randomIncrement + attempt : maxP + randomIncrement + attempt;
    const code = `${prefix}${orderNumber}`;

    // Check uniqueness against DB
    const { count } = await supabase
      .from('stops')
      .select('id', { count: 'exact', head: true })
      .eq('order_code', code);

    if (count === 0) return code;
    // Collision: bump maxP and retry
    maxP = orderNumber;
  }

  // Fallback: append timestamp fragment to guarantee uniqueness
  const fallback = maxP + Math.floor(Math.random() * 10) + 5;
  return `${prefix}${fallback}`;
}
