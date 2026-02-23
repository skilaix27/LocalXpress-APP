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

  const { count } = await supabase
    .from('stops')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString())
    .lte('created_at', endOfDay.toISOString());

  const orderNumber = ((count ?? 0) + 1) * 5;

  return `LX-D${dayCode}${monthLetter}-P${orderNumber}`;
}
