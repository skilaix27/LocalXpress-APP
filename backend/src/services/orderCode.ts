import { queryOne } from '../db';

const MONTH_LETTERS: Record<number, string> = {
  1: 'E', 2: 'F', 3: 'MZ', 4: 'A', 5: 'M',
  6: 'JN', 7: 'JL', 8: 'AG', 9: 'S', 10: 'O',
  11: 'N', 12: 'D',
};

// Regex for valid external order codes
export const LXP_CODE_REGEX = /^LXP-D\d+[A-Z]+-P\d+$/;
export const LX_CODE_REGEX  = /^LX-D\d+[A-Z]+-P\d+$/;

/**
 * Generates a unique order code with the given prefix.
 * Format: {prefix}-D{day+27}{monthLetter}-P{globalSequentialNumber}
 *
 * The P-number is a single global counter shared between LX and LXP to guarantee
 * no collisions. It reads the current max from both stops and stops_archive,
 * then jumps +1..+5 randomly per attempt.
 */
export async function generateOrderCode(
  referenceDate?: string | Date | null,
  prefix: 'LX' | 'LXP' = 'LX',
): Promise<string> {
  const date =
    referenceDate instanceof Date ? referenceDate
    : referenceDate ? new Date(referenceDate)
    : new Date();

  const dayCode     = date.getDate() + 27;
  const monthLetter = MONTH_LETTERS[date.getMonth() + 1];

  // Read global max P-number from live stops and archive (shared counter)
  const row = await queryOne<{ max_p: number }>(
    `SELECT COALESCE(
       MAX(CAST(SUBSTRING(order_code FROM '-P([0-9]+)$') AS INTEGER)),
       62
     ) AS max_p
     FROM (
       SELECT order_code FROM stops        WHERE order_code ~ '^LX[P]?-D'
       UNION ALL
       SELECT order_code FROM stops_archive WHERE order_code ~ '^LX[P]?-D'
     ) AS all_codes`,
    [],
  );

  let currentMax = row?.max_p ?? 62;
  console.log(`[order-code] Last ${prefix} P number: ${currentMax}`);

  for (let attempt = 0; attempt < 5; attempt++) {
    const increment = Math.floor(Math.random() * 5) + 1;
    currentMax += increment;
    const code = `${prefix}-D${dayCode}${monthLetter}-P${currentMax}`;

    const inStops   = await queryOne('SELECT 1 FROM stops         WHERE order_code = $1', [code]);
    const inArchive = await queryOne('SELECT 1 FROM stops_archive WHERE order_code = $1', [code]);

    if (!inStops && !inArchive) {
      console.log(`[order-code] Generated ${code}`);
      return code;
    }
    console.log(`[order-code] Duplicate detected (${code}), retrying (attempt ${attempt + 1})`);
  }

  // Last-resort: big jump to clear any cluster of collisions
  const safeCode = `${prefix}-D${dayCode}${monthLetter}-P${currentMax + Math.floor(Math.random() * 20) + 10}`;
  console.log(`[order-code] Generated fallback ${safeCode}`);
  return safeCode;
}
