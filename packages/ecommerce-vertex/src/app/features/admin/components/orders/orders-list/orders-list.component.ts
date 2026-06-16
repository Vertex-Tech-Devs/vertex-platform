import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import type { Order } from '@core/models/order.model';
import { OrderService } from '@core/services/order.service';
import type { Observable } from 'rxjs';
import { BehaviorSubject, combineLatest, from, of } from 'rxjs';
import {
  map,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  startWith,
} from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { SweetAlertService } from '@core/services/sweet-alert.service';

@Component({
  selector: 'app-orders-list',
  templateUrl: './orders-list.component.html',
  styleUrls: ['./orders-list.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyPipe, DatePipe, TitleCasePipe],
})
export class OrdersListComponent implements OnInit {
  private _orderService = inject(OrderService);
  private _router = inject(Router);
  private _sweetAlertService = inject(SweetAlertService);

  currentPageSubject = new BehaviorSubject<number>(1);
  itemsPerPageSubject = new BehaviorSubject<number>(10);
  searchTermSubject = new BehaviorSubject<string>('');
  filterStatusSubject = new BehaviorSubject<string>('all');

  private refreshTrigger = new BehaviorSubject<void>(undefined);

  itemsPerPageOptions = [5, 10, 20, 50];
  statusOptions = ['all', 'pending', 'shipped', 'delivered', 'cancelled'];

  totalOrders = 0;
  totalPages = 0;

  orders$!: Observable<Order[]>;

  ngOnInit(): void {
    this.orders$ = combineLatest([
      this.refreshTrigger.pipe(
        switchMap(() =>
          this._orderService.getOrders().pipe(
            startWith([] as Order[]),
            catchError((err) => {
              console.error('Error al cargar los pedidos:', err);
              return of([] as Order[]);
            })
          )
        )
      ),
      this.searchTermSubject.pipe(debounceTime(300), distinctUntilChanged()),
      this.filterStatusSubject,
      this.currentPageSubject,
      this.itemsPerPageSubject,
    ]).pipe(
      map(([orders, searchTerm, filterStatus, currentPage, itemsPerPage]) => {
        let filteredOrders = orders;

        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          filteredOrders = orders.filter(
            (order) =>
              order.clientName.toLowerCase().includes(lowerSearch) ||
              order.id.toLowerCase().includes(lowerSearch) ||
              order.status.toLowerCase().includes(lowerSearch)
          );
        }

        if (filterStatus !== 'all') {
          filteredOrders = filteredOrders.filter((order) => order.status === filterStatus);
        }

        this.totalOrders = filteredOrders.length;
        this.totalPages = Math.ceil(this.totalOrders / itemsPerPage);

        let correctedPage = currentPage;
        if (currentPage > this.totalPages && this.totalPages > 0) {
          correctedPage = this.totalPages;
        } else if (this.totalPages === 0) {
          correctedPage = 1;
        }

        const startIndex = (correctedPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        return filteredOrders.slice(startIndex, endIndex);
      })
    );
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPageSubject.next(page);
    }
  }

  onItemsPerPageChange(newValue: string | number): void {
    this.itemsPerPageSubject.next(Number(newValue));
    this.currentPageSubject.next(1);
  }

  onSearchTermChange(newValue: string): void {
    this.searchTermSubject.next(newValue);
    this.currentPageSubject.next(1);
  }

  onFilterStatusChange(newValue: string): void {
    this.filterStatusSubject.next(newValue);
    this.currentPageSubject.next(1);
  }

  editOrder(order: Order): void {
    void this._router.navigate(['/admin/orders', order.id]);
  }

  deleteOrder(order: Order): void {
    void this._sweetAlertService
      .confirm('Eliminar Pedido', `¿Estás seguro de que quieres eliminar el pedido ${order.id}?`)
      .then((confirmed) => {
        if (confirmed) {
          from(this._orderService.deleteOrder(order.id)).subscribe({
            next: () => {
              this.refreshTrigger.next();
            },
            error: (error: unknown) => {
              console.error('Error al eliminar el pedido:', error);
            },
          });
        }
      });
  }
}
