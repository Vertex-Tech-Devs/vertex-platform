import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { BsModalRef } from 'ngx-bootstrap/modal';
import type { Order, OrderItem } from '@core/models/order.model';
import { StoreConfigService } from '@core/services/store-config.service';
import { SumItemsPipe } from '../../shared/pipes/sum-items/sum-items.pipe';

@Component({
  selector: 'app-receipt-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, SumItemsPipe],
  templateUrl: './receipt-modal.component.html',
  styleUrls: ['./receipt-modal.component.scss'],
})
export class ReceiptModalComponent {
  bsModalRef = inject(BsModalRef);
  private readonly storeConfig = inject(StoreConfigService);
  title = 'Recibo de Pedido';
  order: Order | undefined;
  today = new Date();
  readonly storeName = this.storeConfig.storeName;
  readonly logoUrl = this.storeConfig.logoUrl;

  currencyCode(): string {
    return 'ARS';
  }

  currencySymbol(): string {
    return '$';
  }

  getItemSubtotal(item: OrderItem): number {
    return item.quantity * item.price;
  }

  close(): void {
    this.bsModalRef.hide();
  }

  printReceipt(): void {
    window.print();
  }
}
