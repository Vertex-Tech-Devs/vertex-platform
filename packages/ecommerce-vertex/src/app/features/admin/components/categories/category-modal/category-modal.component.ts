import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormGroup, AbstractControl } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BsModalRef } from 'ngx-bootstrap/modal';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import type { Category } from '@core/models/category.model';
import type { Attribute } from '@core/models/attribute.model';
import { AttributeService } from '@core/services/attribute.service';

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './category-modal.component.html',
  styleUrls: ['./category-modal.component.scss'],
})
export class CategoryModalComponent implements OnInit {
  title: string = 'Nueva Categoría';
  category?: Category;
  onClose: Subject<
    | (Partial<Omit<Category, 'id' | 'name' | 'slug' | 'parentId'>> & {
        name: string;
        slug: string;
        parentId: string | null;
        filterableAttributes: string[];
      })
    | null
  > = new Subject();

  bsModalRef = inject(BsModalRef);
  private fb = inject(FormBuilder);
  private attributeService = inject(AttributeService);

  categoryForm!: FormGroup;
  attributes$!: Observable<Attribute[]>;

  ngOnInit(): void {
    this.attributes$ = this.attributeService.getAttributes();
    this.title = this.category ? 'Editar Categoría' : 'Nueva Categoría';

    this.categoryForm = this.fb.group({
      name: [this.category?.name ?? '', [Validators.required, Validators.minLength(3)]],
      parentId: [this.category?.parentId ?? null],
      attributesForm: this.fb.group({}),
    });

    this.attributes$.subscribe((attributes) => {
      const attributesGroup = this.categoryForm.get('attributesForm') as FormGroup;
      attributes.forEach((attr) => {
        const isChecked = this.category?.filterableAttributes?.includes(attr.id!) ?? false;
        attributesGroup.addControl(attr.id!, this.fb.control(isChecked));
      });
    });
  }

  get name(): AbstractControl | null {
    return this.categoryForm.get('name');
  }

  get attributesForm(): FormGroup {
    return this.categoryForm.get('attributesForm') as FormGroup;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  save(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const formData = this.categoryForm.value;
    const slug = this.generateSlug(formData.name);

    const selectedAttributeIds = Object.keys(formData.attributesForm).filter(
      (id) => formData.attributesForm[id]
    );

    this.onClose.next({
      name: formData.name,
      slug,
      parentId: formData.parentId ?? null,
      filterableAttributes: selectedAttributeIds,
    });
    this.bsModalRef.hide();
  }

  cancel(): void {
    this.onClose.next(null);
    this.bsModalRef.hide();
  }
}
