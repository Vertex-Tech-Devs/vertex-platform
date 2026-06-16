import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormGroup, FormArray, AbstractControl } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { Subject } from 'rxjs';
import type { Attribute } from '@core/models/attribute.model';

@Component({
  selector: 'app-attribute-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './attribute-modal.component.html',
  styleUrls: ['./attribute-modal.component.scss'],
})
export class AttributeModalComponent implements OnInit {
  title: string = 'Nuevo Atributo';
  attribute?: Attribute;
  onClose: Subject<Partial<Attribute> | null> = new Subject();

  bsModalRef = inject(BsModalRef);
  private fb = inject(FormBuilder);
  attributeForm!: FormGroup;

  ngOnInit(): void {
    if (this.attribute) {
      this.title = 'Editar Atributo';
    }

    this.attributeForm = this.fb.group({
      name: [this.attribute?.name ?? '', [Validators.required, Validators.minLength(3)]],
      values: this.fb.array(
        this.attribute?.values
          ? this.attribute.values.map((val) => this.fb.control(val, Validators.required))
          : []
      ),
    });
  }

  get name(): AbstractControl | null {
    return this.attributeForm.get('name');
  }

  get values(): FormArray {
    return this.attributeForm.get('values') as FormArray;
  }

  addValue(): void {
    if (this.values.length >= 50) {
      return;
    }
    this.values.push(this.fb.control('', Validators.required));
  }

  removeValue(index: number): void {
    this.values.removeAt(index);
  }

  save(): void {
    if (this.attributeForm.invalid) {
      this.attributeForm.markAllAsTouched();
      return;
    }

    const formData = this.attributeForm.value;

    const rawValues = this.values.getRawValue() as string[];

    const cleanedValues: string[] = rawValues
      .map((val) => String(val ?? '').trim())
      .filter((val) => val.length > 0);

    const uniqueValues: string[] = [...new Set(cleanedValues)];

    this.onClose.next({
      name: formData.name,
      values: uniqueValues,
    });
    this.bsModalRef.hide();
  }

  cancel(): void {
    this.onClose.next(null);
    this.bsModalRef.hide();
  }
}
