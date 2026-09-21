const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(priceCents: number): string {
  return currencyFormatter.format(priceCents / 100);
}
