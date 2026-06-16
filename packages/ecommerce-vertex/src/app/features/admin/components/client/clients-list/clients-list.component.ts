import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ClientService } from '../../../../../core/services/client.service';
import type { Client } from '../../../../../core/models/client.model';
import type { Observable } from 'rxjs';
import {
  BehaviorSubject,
  combineLatest,
  map,
  debounceTime,
  distinctUntilChanged,
  startWith,
  catchError,
  of,
} from 'rxjs';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  searchTermSubject = new BehaviorSubject<string>('');
  currentPageSubject = new BehaviorSubject<number>(1);
  itemsPerPageSubject = new BehaviorSubject<number>(10);

  itemsPerPageOptions = [5, 10, 20, 30];

  totalClients = 0;
  totalPages = 0;

  clients$!: Observable<Client[]>;

  private _clientService = inject(ClientService);
  private _router = inject(Router);

  ngOnInit(): void {
    this.clients$ = combineLatest([
      this._clientService.getClients().pipe(
        startWith([] as Client[]),
        catchError((err) => {
          console.error('Error al cargar la lista de clientes:', err);
          return of([] as Client[]);
        })
      ),
      this.searchTermSubject.pipe(debounceTime(300), distinctUntilChanged()),
      this.currentPageSubject,
      this.itemsPerPageSubject,
    ]).pipe(
      map(([allClients, searchTerm, currentPage, itemsPerPage]) => {
        let filteredClients = allClients;
        if (searchTerm) {
          const lowerCaseSearchTerm = searchTerm.toLowerCase();
          filteredClients = filteredClients.filter(
            (client) =>
              client.fullName.toLowerCase().includes(lowerCaseSearchTerm) ||
              client.email.toLowerCase().includes(lowerCaseSearchTerm)
          );
        }

        this.totalClients = filteredClients.length;
        this.totalPages = Math.ceil(this.totalClients / itemsPerPage);

        let correctedPage = currentPage;
        if (currentPage > this.totalPages && this.totalPages > 0) {
          correctedPage = this.totalPages;
        } else if (this.totalPages === 0) {
          correctedPage = 1;
        }

        const startIndex = (correctedPage - 1) * itemsPerPage;
        return filteredClients.slice(startIndex, startIndex + itemsPerPage);
      })
    );
  }

  onSearchChange(newValue: string): void {
    this.searchTermSubject.next(newValue);
    this.currentPageSubject.next(1);
  }

  onItemsPerPageChange(newValue: string): void {
    this.itemsPerPageSubject.next(Number(newValue));
    this.currentPageSubject.next(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPageSubject.next(page);
    }
  }

  viewClientHistory(email: string): void {
    void this._router.navigate(['/admin/customers', email]);
  }
}
