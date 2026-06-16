import type { OnInit } from '@angular/core';
import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/shared/components/header/header.component';
import { SidebarComponent } from './components/shared/components/sidebar/sidebar.component';
import { StoreConfigService } from '@core/services/store-config.service';
import { FirstRunWizardComponent } from './components/first-run-wizard/first-run-wizard.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent, FirstRunWizardComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit {
  isSidebarOpen: boolean = false;

  private readonly breakpointLg = 1024;
  private readonly storeConfigService = inject(StoreConfigService);
  private readonly router = inject(Router);

  readonly isFirstRun = this.storeConfigService.isFirstRun;

  constructor() {}

  ngOnInit(): void {
    this.checkScreenSize();
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    if (this.isSidebarOpen) {
      this.isSidebarOpen = false;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(_event: Event): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    if (window.innerWidth > this.breakpointLg) {
      this.isSidebarOpen = false;
    }
  }
}
