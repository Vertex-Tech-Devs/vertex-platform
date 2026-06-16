export interface Client {
  id?: string;
  email: string;
  fullName: string;
  phone: string;
  firstOrderDate: Date;
  lastOrderDate: Date;
  numberOfOrders: number;
}
