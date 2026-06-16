import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import type { OrderItem } from '@core/models/order.model';

@Pipe({
  name: 'sumItems',
  standalone: true,
})
export class SumItemsPipe implements PipeTransform {
  transform(
    items: OrderItem[] | undefined,
    priceKey: keyof OrderItem,
    quantityKey: keyof OrderItem
  ): number {
    if (!items || items.length === 0) {
      return 0;
    }
    return items.reduce((sum, item) => {
      const price = Number(item[priceKey]);
      const quantity = Number(item[quantityKey]);
      if (isNaN(price) || isNaN(quantity)) {
        console.warn(
          `SumItemsPipe: Valor no numérico encontrado para ${priceKey} o ${quantityKey} en un item.`,
          item
        );
        return sum;
      }
      return sum + price * quantity;
    }, 0);
  }
}
