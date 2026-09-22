export interface CartItem {
  sku: string;
  quantity: number;
}

export interface Cart {
  cart_id: string;
  items: CartItem[];
}
