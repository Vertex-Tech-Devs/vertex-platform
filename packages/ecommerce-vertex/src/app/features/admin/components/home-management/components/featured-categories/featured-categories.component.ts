import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import type { FormGroup, FormArray } from '@angular/forms';
import type { Category } from '@core/models/category.model';

@Component({
  selector: 'app-featured-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './featured-categories.component.html',
  styleUrls: ['./featured-categories.component.scss'],
})
export class FeaturedCategoriesComponent {
  @Input({ required: true }) formArray!: FormArray;
  @Input({ required: true }) categories: Category[] = [];
  @Input({ required: true }) previewUrls: (string | null)[] = [];

  @Output() add = new EventEmitter<void>();
  @Output() remove = new EventEmitter<number>();
  @Output() categoryChange = new EventEmitter<{ index: number; event: Event }>();
  @Output() fileChange = new EventEmitter<{ index: number; event: Event }>();

  getFormGroup(index: number): FormGroup {
    return this.formArray.at(index) as FormGroup;
  }
}
