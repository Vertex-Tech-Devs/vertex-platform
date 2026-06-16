import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token requires runtime import
import { BsModalRef } from 'ngx-bootstrap/modal';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-confirm-delete-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-delete-modal.component.html',
  styleUrls: ['./confirm-delete-modal.component.scss'],
})
export class ConfirmDeleteModalComponent {
  @Input() title: string = 'Confirmación';
  @Input() message: string = '¿Estás seguro de que deseas realizar esta acción?';
  @Input() confirmButtonText: string = 'Confirmar';
  @Input() cancelButtonText: string = 'Cancelar';

  onClose: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(public bsModalRef: BsModalRef) {}

  onConfirm(): void {
    this.onClose.next(true);
    this.bsModalRef.hide();
  }

  onCancel(): void {
    this.onClose.next(false);
    this.bsModalRef.hide();
  }
}
