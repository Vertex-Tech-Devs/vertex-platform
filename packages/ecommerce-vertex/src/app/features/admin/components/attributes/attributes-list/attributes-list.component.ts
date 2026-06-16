import type { OnInit, OnDestroy } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Observable, Subscription } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token requires runtime import
import { BsModalRef } from 'ngx-bootstrap/modal';
import { BsModalService } from 'ngx-bootstrap/modal';
import type { Attribute } from '@core/models/attribute.model';
import { AttributeService } from '@core/services/attribute.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';
import { AttributeModalComponent } from '../attribute-modal/attribute-modal.component';

@Component({
  selector: 'app-attributes-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attributes-list.component.html',
  styleUrls: ['./attributes-list.component.scss'],
})
export class AttributesListComponent implements OnInit, OnDestroy {
  private attributeService = inject(AttributeService);
  private modalService = inject(BsModalService);
  private sweetAlertService = inject(SweetAlertService);

  attributes$!: Observable<Attribute[]>;
  private bsModalRef?: BsModalRef;
  private modalSubscription?: Subscription;

  ngOnInit(): void {
    this.attributes$ = this.attributeService.getAttributes();
  }

  ngOnDestroy(): void {
    this.modalSubscription?.unsubscribe();
  }

  openAttributeModal(attribute?: Attribute): void {
    const initialState = attribute ? { attribute: { ...attribute } } : {};
    this.bsModalRef = this.modalService.show(AttributeModalComponent, {
      initialState,
      class: 'modal-lg modal-dialog-centered',
    });

    this.modalSubscription = this.bsModalRef.content.onClose.subscribe(
      (result: Partial<Attribute> | null) => {
        if (result) {
          if (attribute?.id) {
            this.updateAttribute(attribute.id, result);
          } else {
            this.addAttribute(result as Attribute);
          }
        }
      }
    );
  }

  private addAttribute(attributeData: Attribute): void {
    this.attributeService
      .addAttribute(attributeData)
      .then(() => this.sweetAlertService.success('¡Éxito!', 'Atributo creado correctamente.'))
      .catch((_err) =>
        this.sweetAlertService.error('Error', 'Hubo un problema al crear el atributo.')
      );
  }

  private updateAttribute(id: string, attributeData: Partial<Attribute>): void {
    this.attributeService
      .updateAttribute(id, attributeData)
      .then(() => this.sweetAlertService.success('¡Éxito!', 'Atributo actualizado correctamente.'))
      .catch((_err) =>
        this.sweetAlertService.error('Error', 'Hubo un problema al actualizar el atributo.')
      );
  }

  async onDelete(attribute: Attribute): Promise<void> {
    const isConfirmed = await this.sweetAlertService.confirm(
      '¿Estás seguro?',
      `Esta acción eliminará el atributo "${attribute.name}". Los productos que lo usen ya no podrán filtrarse por él.`
    );

    if (isConfirmed && attribute.id) {
      try {
        await this.attributeService.deleteAttribute(attribute.id);
        this.sweetAlertService.success('Eliminado', 'El atributo ha sido eliminado.');
      } catch {
        this.sweetAlertService.error('Error', 'Hubo un problema al eliminar el atributo.');
      }
    }
  }
}
