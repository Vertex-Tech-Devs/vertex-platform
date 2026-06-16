import { Injectable } from '@angular/core';
import type { SweetAlertIcon } from 'sweetalert2';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class SweetAlertService {
  constructor() {}

  success(title: string, message: string): void {
    void Swal.fire({
      icon: 'success',
      title,
      text: message,
      confirmButtonText: 'Ok',
      timer: 3000,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
    });
  }

  error(title: string, message: string): void {
    void Swal.fire({
      icon: 'error',
      title,
      text: message,
      confirmButtonText: 'Entendido',
      timer: 5000,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
    });
  }

  warning(title: string, message: string): void {
    void Swal.fire({
      icon: 'warning',
      title,
      text: message,
      confirmButtonText: 'Ok',
      timer: 4000,
      timerProgressBar: true,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
    });
  }

  confirm(title: string, text: string, icon: SweetAlertIcon = 'warning'): Promise<boolean> {
    return Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, estoy seguro',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      return result.isConfirmed;
    });
  }

  loading(title: string, text?: string): void {
    void Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  close(): void {
    Swal.close();
  }
}
