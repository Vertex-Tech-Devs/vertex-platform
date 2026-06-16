import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import type { Observable } from 'rxjs';
import { switchMap, of, combineLatest, map } from 'rxjs';
import type { Order } from '@core/models/order.model';
import { OrderService } from '@core/services/order.service';

interface ConfirmationData {
  order: Order | undefined;
  paymentStatus: string | null;
}

@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe],
  templateUrl: './order-confirmation.component.html',
  styleUrls: ['./order-confirmation.component.scss'],
})
export class OrderConfirmationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);

  data$!: Observable<ConfirmationData>;

  ngOnInit(): void {
    const order$ = this.route.paramMap.pipe(
      switchMap((params) => {
        const orderId = params.get('id');
        if (orderId) {
          return this.orderService.getOrderById(orderId);
        }
        return of(undefined);
      })
    );

    const paymentStatus$ = this.route.queryParamMap.pipe(map((params) => params.get('status')));

    this.data$ = combineLatest({
      order: order$,
      paymentStatus: paymentStatus$,
    });
  }
}
