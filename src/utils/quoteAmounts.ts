/** Issued automatic amounts: round supply to 100 won, VAT to won, then total to 100 won.
 * Existing saved amounts are preserved on non-financial edits; never normalize them here.
 */
export function calculateAutomaticQuoteTotals(items: { totalPrice: number; quantity: number }[]) {
  if (items.some(item => !Number.isFinite(item.totalPrice) || item.totalPrice < 0 || item.totalPrice > Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('품목 금액과 수량을 확인해 주세요.');
  }
  // Sum the decimal values sent in JSON, exactly like PostgreSQL numeric.
  // Binary float accumulation can move a valid amount across the 50-won boundary.
  let units = 0n;
  let scale = 0;
  for (const item of items) {
    const [mantissa, exponent = '0'] = String(item.totalPrice).split('e');
    const decimals = (mantissa.split('.')[1]?.length || 0) - Number(exponent);
    const itemScale = Math.max(0, decimals);
    if (itemScale > scale) {
      units *= 10n ** BigInt(itemScale - scale);
      scale = itemScale;
    }
    units += BigInt(mantissa.replace('.', '')) * BigInt(item.quantity) * 10n ** BigInt(scale - decimals);
  }
  const denominator = 10n ** BigInt(scale);
  const supply = ((units + 50n * denominator) / (100n * denominator)) * 100n;
  const vat = supply / 10n;
  const subtotal = Number(supply);
  const tax = Number(vat);
  const total = Number(((supply + vat + 50n) / 100n) * 100n);
  if (![subtotal, tax, total].every(Number.isSafeInteger)) throw new Error('견적 금액이 유효하지 않습니다.');
  return { subtotal, tax, total };
}

/** Preserve the existing VAT-included manual override policy. */
export function calculateManualQuoteTotals(total: number) {
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('견적 금액이 유효하지 않습니다.');
  const subtotal = Number((BigInt(total) * 10n + 5n) / 11n);
  return { subtotal, tax: total - subtotal, total };
}
