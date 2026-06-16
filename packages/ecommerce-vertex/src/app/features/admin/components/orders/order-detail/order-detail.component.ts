import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import type { Order, OrderItem, OrderStatus } from '@core/models/order.model';
import { OrderService } from '@core/services/order.service';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { SumItemsPipe } from '../../shared/pipes/sum-items/sum-items.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token requires runtime import
import { BsModalRef } from 'ngx-bootstrap/modal';
import { BsModalService } from 'ngx-bootstrap/modal';
import { ReceiptModalComponent } from '../receipt-modal/receipt-modal.component';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    TitleCasePipe,
    SumItemsPipe,
  ],
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.scss'],
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private modalService = inject(BsModalService);

  bsModalRef?: BsModalRef;
  order$!: Observable<Order | undefined>;
  orderId: string | null = null;
  pageTitle: string = 'Detalles del Pedido';

  currentStatus: OrderStatus = 'pending';
  statusOptions: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  ngOnInit(): void {
    this.order$ = this.route.paramMap.pipe(
      switchMap((params) => {
        this.orderId = params.get('id');

        if (this.orderId) {
          return this.orderService.getOrderById(this.orderId).pipe(
            tap((order) => {
              if (order) {
                this.currentStatus = order.status;
              } else {
                this.pageTitle = 'Pedido No Encontrado';
              }
            })
          );
        } else {
          this.pageTitle = 'Error: ID de Pedido Faltante';
          void this.router.navigate(['/admin/orders']);
          return of(undefined);
        }
      })
    );
  }

  goBack(): void {
    void this.router.navigate(['/admin/orders']);
  }

  onStatusChange(event: Event): void {
    const newStatus = (event.target as HTMLSelectElement).value as OrderStatus;
    if (this.orderId && newStatus !== this.currentStatus) {
      this.orderService
        .updateOrder(this.orderId, { status: newStatus })
        .then(() => {
          this.currentStatus = newStatus;
        })
        .catch((error) => {
          console.error('Error al actualizar el estado del pedido:', error);
        });
    }
  }

  getItemSubtotal(item: OrderItem): number {
    return item.quantity * item.price;
  }

  generateReceipt(order: Order): void {
    const initialState = {
      order,
      title: `Recibo del Pedido`,
    };

    this.bsModalRef = this.modalService.show(ReceiptModalComponent, {
      initialState,
      class: 'modal-lg modal-dialog-centered modal-receipt-wrapper',
      backdrop: 'static',
    });
  }
}
