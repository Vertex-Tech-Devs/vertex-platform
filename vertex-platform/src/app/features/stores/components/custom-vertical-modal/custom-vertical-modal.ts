import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import type { VerticalOption } from '@core/constants/business-verticals.constants';

@Component({
  selector: 'app-custom-vertical-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './custom-vertical-modal.html',
  styleUrl: './custom-vertical-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomVerticalModal implements OnInit {
  private fb = inject(FormBuilder);
  private storesService = inject(StoresService);

  readonly initialName = input<string>('');
  readonly close = output<void>();
  readonly created = output<VerticalOption>();

  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly categoriesList = signal<string[]>(['Productos Destacados', 'Novedades', 'Ofertas']);

  readonly quickEmojis: string[] = [
    '🏷️', '🍔', '👗', '💻', '☕', '🍺', '🚲', '🎨', '🌿', '🛠️', '🎮', '🎂', '🧼', '📦', '✂️', '📸', '🍕', '🌸', '👟', '💍',
  ];

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    icon: ['🏷️', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    categoryInput: [''],
    primaryColor: ['#6366f1'],
    accentColor: ['#06b6d4'],
    bannerTitle: [''],
    bannerSubtitle: [''],
  });

  ngOnInit(): void {
    if (this.initialName()) {
      this.form.patchValue({ name: this.initialName() });
    }
  }

  selectEmoji(emoji: string): void {
    this.form.patchValue({ icon: emoji });
  }

  addCategory(): void {
    const val = this.form.get('categoryInput')?.value?.trim();
    if (val && !this.categoriesList().includes(val)) {
      this.categoriesList.update((cats) => [...cats, val]);
      this.form.patchValue({ categoryInput: '' });
    }
  }

  removeCategory(index: number): void {
    this.categoriesList.update((cats) => cats.filter((_, i) => i !== index));
  }

  onKeyDownCategory(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addCategory();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKeyDown(): void {
    this.onCancel();
  }

  onCancel(): void {
    if (!this.isSubmitting()) {
      this.close.emit();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, icon, description, primaryColor, accentColor, bannerTitle, bannerSubtitle } =
      this.form.value;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const res = await this.storesService.createCustomVertical({
        name: name!,
        icon: icon || '🏷️',
        description: description!,
        categories: this.categoriesList(),
        themeColors: {
          primary: primaryColor || '#6366f1',
          accent: accentColor || '#06b6d4',
          background: '#0f172a',
        },
        bannerTitle: bannerTitle || `¡Bienvenidos a ${name}!`,
        bannerSubtitle: bannerSubtitle || 'Descubrí nuestras colecciones exclusivas.',
      });

      if (res?.vertical) {
        this.created.emit(res.vertical);
      }
      this.close.emit();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String(err.message)
            : 'Error al guardar el nuevo rubro.';
      this.errorMessage.set(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
