import { supabase } from '@/integrations/supabase/client';

/**
 * Generates an order code with format: LX-D{day+27}{monthLetter}-P{n*5}
 * Month letters: E(nero), F(ebrero), M(arzo), A(bril), Y(mayo), J(unio),
 *                L(julio), G(agosto), S(eptiembre), O(ctubre), N(oviembre), D(iciembre)
 */
const MONTH_LETTERS = ['E', 'F', 'M', 'A', 'Y', 'J', 'L', 'G', 'S', 'O', 'N', 'D'];

export async function generateOrderCode(): Promise<string> {
  const now = new Date();
  const day = now.getDate();
  const dayCode = day + 27;
  const monthLetter = MONTH_LETTERS[now.getMonth()];

  // Count today's stops to determine order number
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // Get the highest P number from today's stops
  const { data: todayStops } = await supabase
    .from('stops')
    .select('order_code')
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString())
    .not('order_code', 'is', null);

  let maxP = 0;
  if (todayStops) {
    for (const s of todayStops) {
      const match = s.order_code?.match(/-P(\d+)$/);
      if (match) maxP = Math.max(maxP, parseInt(match[1], 10));
    }
  }

  // Start above 27, then add random increment (1-3)
  const randomIncrement = Math.floor(Math.random() * 3) + 1;
  const orderNumber = maxP < 27 ? 27 + randomIncrement : maxP + randomIncrement;

  return `LX-D${dayCode}${monthLetter}-P${orderNumber}`;
}
