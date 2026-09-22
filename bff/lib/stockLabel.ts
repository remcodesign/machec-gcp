export interface StockLabel {
  text: string;
  className: string;
  inStock: boolean;
}

export function stockLabel(stock: number | undefined): StockLabel {
  if (stock !== undefined && stock <= 0)
    return {
      text: "Niet op voorraad",
      className: "text-red-700",
      inStock: false,
    };

  return { text: "Op voorraad", className: "text-emerald-700", inStock: true };
}
