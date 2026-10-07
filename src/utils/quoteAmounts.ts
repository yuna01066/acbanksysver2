/** Issued automatic amounts: round supply to 100 won, VAT to won, then total to 100 won.
 * Existing saved amounts are preserved on non-financial edits; never normalize them here.
 */
export function calculateAutomaticQuoteTotals(items: { totalPrice: number; quantity: number }[]) {
  if (items.some(item => !Number.isFinite(item.totalPrice) || item.totalPrice < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new Error('품목 금액과 수량을 확인해 주세요.');
  }
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0) / 100) * 100;
  const tax = Math.round(subtotal * 0.1);
  const total = Math.round((subtotal + tax) / 100) * 100;
  if (![subtotal, tax, total].every(Number.isFinite)) throw new Error('견적 금액이 유효하지 않습니다.');
  return { subtotal, tax, total };
}

/** Preserve the existing VAT-included manual override policy. */
export function calculateManualQuoteTotals(total: number) {
  if (!Number.isFinite(total) || !Number.isInteger(total) || total <= 0) throw new Error('견적 금액이 유효하지 않습니다.');
  const subtotal = Math.round(total / 1.1);
  return { subtotal, tax: total - subtotal, total };
}
