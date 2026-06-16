import type { OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  HostListener,
  computed,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, SlicePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import type { Observable } from 'rxjs';
import { combineLatest, map, catchError, of } from 'rxjs';
import { ProductService } from '@core/services/product.service';
import { OrderService } from '@core/services/order.service';
import { ClientService } from '@core/services/client.service';
import type { Order } from '@core/models/order.model';
import type { Product } from '@core/models/product.model';
import type { Client } from '@core/models/client.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterModule, SlicePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private clientService = inject(ClientService);

  activeTab = signal<'orders' | 'clients' | 'products'>('orders');
  screenWidth = signal<number>(window.innerWidth);
  isMobile = computed(() => this.screenWidth() < 768);

  monthlyMetrics$!: Observable<{ sales: number; orders: number; newClients: number }>;
  globalMetrics$!: Observable<{
    totalSales: number;
    totalOrders: number;
    totalClients: number;
  }>;
  pendingOrders$!: Observable<Order[]>;
  lowStockProducts$!: Observable<Product[]>;
  latestOrders$!: Observable<Order[]>;
  latestClients$!: Observable<Client[]>;
  latestProducts$!: Observable<Product[]>;

  @HostListener('window:resize')
  onResize(): void {
    this.screenWidth.set(window.innerWidth);
  }

  ngOnInit(): void {
    this.monthlyMetrics$ = combineLatest([
      this.orderService.getMonthlySalesAndOrders(),
      this.clientService.getNewClientsThisMonth(),
    ]).pipe(
      map(([orderStats, newClientsCount]) => ({
        sales: orderStats.monthlySales,
        orders: orderStats.monthlyOrders,
        newClients: newClientsCount,
      })),
      catchError(() => of({ sales: 0, orders: 0, newClients: 0 }))
    );

    this.globalMetrics$ = combineLatest([
      this.orderService.getGlobalSalesAndOrders(),
      this.clientService.getTotalClients(),
    ]).pipe(
      map(([orderStats, totalClientsCount]) => ({
        totalSales: orderStats.totalSales,
        totalOrders: orderStats.totalOrders,
        totalClients: totalClientsCount,
      })),
      catchError(() => of({ totalSales: 0, totalOrders: 0, totalClients: 0 }))
    );

    this.pendingOrders$ = this.orderService.getPendingOrProcessingOrders();
    this.lowStockProducts$ = this.productService.getProductsLowInStock(10);
    this.latestOrders$ = this.orderService.getLatestOrders(10);
    this.latestClients$ = this.clientService.getLatestClients(10);
    this.latestProducts$ = this.productService.getLatestProducts(10);
  }

  setTab(tab: 'orders' | 'clients' | 'products'): void {
    this.activeTab.set(tab);
  }
}
