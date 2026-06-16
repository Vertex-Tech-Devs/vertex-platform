import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormArray, FormGroup } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, take } from 'rxjs/operators';
import { BehaviorSubject, combineLatest } from 'rxjs';
import type { Observable } from 'rxjs';

import { HomeContentService } from '@core/services/home-content.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';
import { CategoryService } from '@core/services/category.service';
import { ProductService } from '@core/services/product.service';
import { HeroLinkModalComponent } from './components/hero-link-modal/hero-link-modal.component';
import { FeaturedCategoriesComponent } from './components/featured-categories/featured-categories.component';

import type {
  CarouselSettings,
  FeaturedCategory,
  HeroBanner,
  HeroImage,
} from '@core/models/home-content.model';
import type { Category } from '@core/models/category.model';
import type { Product } from '@core/models/product.model';

import { HeroImageUploaderService, MAX_HERO_IMAGES } from './hero-image-uploader.service';

@Component({
  selector: 'app-home-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeroLinkModalComponent, FeaturedCategoriesComponent],
  templateUrl: './home-management.component.html',
  styleUrls: ['./home-management.component.scss'],
})
export class HomeManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private homeContentService = inject(HomeContentService);
  private sweetAlertService = inject(SweetAlertService);
  private categoryService = inject(CategoryService);
  private productService = inject(ProductService);
  private heroUploader = inject(HeroImageUploaderService);

  bannerForm!: FormGroup;
  isSubmitting = false;
  categories$!: Observable<Category[]>;
  products$!: Observable<Product[]>;

  productSearchTerm$ = new BehaviorSubject<string>('');
  filteredProducts$!: Observable<Product[]>;

  heroImages: HeroImage[] = [];
  selectedHeroFiles: File[] = [];
  heroImagePreviews: string[] = [];
  isDragOver = false;
  carouselSettings: CarouselSettings = { interval: 4000, showIndicators: true };

  selectedCategoryFiles: (File | null)[] = [];
  categoryPreviewUrls: (string | null)[] = [];

  isLinkModalVisible = false;
  activeHeroIndex = -1;

  private categoryMap = new Map<string, { name: string; slug: string }>();
  private readonly MAX_HERO = MAX_HERO_IMAGES;

  ngOnInit(): void {
    this.initializeForm();

    this.categories$ = this.categoryService.getCategories().pipe(
      take(1),
      map((categories: Category[]) => {
        this.categoryMap.clear();
        categories.forEach((cat: Category) =>
          this.categoryMap.set(cat.id!, { name: cat.name, slug: cat.slug })
        );
        return categories;
      })
    );

    this.products$ = this.productService.getProducts();

    this.filteredProducts$ = combineLatest([this.products$, this.productSearchTerm$]).pipe(
      map(([products, term]) => {
        if (!term) {
          return products;
        }
        const lowerTerm = term.toLowerCase();
        return products.filter((p) => p.name.toLowerCase().includes(lowerTerm));
      })
    );

    this.loadContentData();
  }

  private initializeForm(): void {
    this.bannerForm = this.fb.group({
      carouselSettings: this.fb.group({
        interval: [4000, [Validators.required, Validators.min(1000)]],
        showIndicators: [true],
      }),
      featuredCategories: this.fb.array([]),
    });
  }

  private loadContentData(): void {
    this.homeContentService
      .getHeroBanner()
      .pipe(take(1))
      .subscribe((content) => {
        if (!content) {
          return;
        }
        if (content.heroImages?.length) {
          this.heroImages = content.heroImages.map((img: string | HeroImage) => {
            if (typeof img === 'string') {
              return { imageUrl: img, linkType: 'none' };
            }
            return img;
          });
          this.heroImagePreviews = this.heroImages.map((h) => h.imageUrl);
          this.selectedHeroFiles = [];
        }
        if (content.carouselSettings) {
          this.carouselSettings = { ...content.carouselSettings };
        }
        this.bannerForm.patchValue({ carouselSettings: this.carouselSettings });
        this.featuredCategories.clear();
        this.selectedCategoryFiles = [];
        this.categoryPreviewUrls = [];
        content.featuredCategories?.forEach((cat) => this.addFeaturedCategory(cat));
      });
  }

  get featuredCategories(): FormArray {
    return this.bannerForm.get('featuredCategories') as FormArray;
  }

  get carouselSettingsGroup(): FormGroup {
    return this.bannerForm.get('carouselSettings') as FormGroup;
  }

  get emptySlots(): null[] {
    return Array(Math.max(0, this.MAX_HERO - this.heroImagePreviews.length)).fill(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.heroImages.length < this.MAX_HERO) {
      this.isDragOver = true;
    }
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (this.heroImages.length >= this.MAX_HERO) {
      return;
    }
    const files = event.dataTransfer?.files;
    if (!files?.length) {
      return;
    }
    void this.onHeroImagesSelected({ target: { files } } as unknown as Event);
  }

  private newFeaturedCategory(category?: FeaturedCategory): FormGroup {
    return this.fb.group({
      categoryId: [category?.categoryId ?? null, Validators.required],
      name: [category?.name ?? ''],
      slug: [category?.slug ?? ''],
      imageUrl: [category?.imageUrl ?? '', [Validators.pattern('https?://.+')]],
    });
  }

  addFeaturedCategory(category?: FeaturedCategory): void {
    if (this.featuredCategories.length < 3) {
      this.featuredCategories.push(this.newFeaturedCategory(category));
      this.selectedCategoryFiles.push(null);
      this.categoryPreviewUrls.push(null);
    }
  }

  removeFeaturedCategory(index: number): void {
    this.featuredCategories.removeAt(index);
    this.selectedCategoryFiles.splice(index, 1);
    this.categoryPreviewUrls.splice(index, 1);
  }

  onCategorySelectionChange(index: number, event: Event): void {
    const selectedId = (event.target as HTMLSelectElement).value;
    const categoryData = this.categoryMap.get(selectedId);
    if (categoryData) {
      this.featuredCategories
        .at(index)
        .patchValue({ name: categoryData.name, slug: categoryData.slug });
    }
  }

  async onHeroImagesSelected(event: Event): Promise<void> {
    const batch = await this.heroUploader.processFiles(event, this.heroImages.length);
    if (!batch) {
      return;
    }
    batch.ids.forEach((id, i) => {
      this.heroImages.push({ imageUrl: id, linkType: 'none' });
      this.heroImagePreviews.push(batch.previews[i]);
      this.selectedHeroFiles.push(batch.files[i]);
    });
    this.bannerForm.markAsDirty();
  }

  removeHeroImage(index: number): void {
    this.heroImages.splice(index, 1);
    this.heroImagePreviews.splice(index, 1);
    this.selectedHeroFiles.splice(index, 1);
    this.bannerForm.markAsDirty();
  }

  moveHeroImageUp(index: number): void {
    if (index > 0) {
      this.swapHeroImages(index, index - 1);
    }
  }

  moveHeroImageDown(index: number): void {
    if (index < this.heroImages.length - 1) {
      this.swapHeroImages(index, index + 1);
    }
  }

  private swapHeroImages(a: number, b: number): void {
    [this.heroImages[a], this.heroImages[b]] = [this.heroImages[b], this.heroImages[a]];
    [this.heroImagePreviews[a], this.heroImagePreviews[b]] = [
      this.heroImagePreviews[b],
      this.heroImagePreviews[a],
    ];
    [this.selectedHeroFiles[a], this.selectedHeroFiles[b]] = [
      this.selectedHeroFiles[b],
      this.selectedHeroFiles[a],
    ];
    this.bannerForm.markAsDirty();
  }

  onFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.sweetAlertService.error(
        'Archivo no válido',
        'Por favor, selecciona un archivo de imagen.'
      );
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (): void => {
      this.selectedCategoryFiles[index] = file;
      this.categoryPreviewUrls[index] = reader.result as string;
      this.featuredCategories.at(index).get('imageUrl')?.setValue('');
      this.bannerForm.markAsDirty();
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  openLinkModal(index: number): void {
    this.activeHeroIndex = index;
    this.productSearchTerm$.next('');
    this.isLinkModalVisible = true;
  }

  closeLinkModal(): void {
    this.isLinkModalVisible = false;
    this.activeHeroIndex = -1;
  }

  updateLinkType(type: 'product' | 'category' | 'none'): void {
    this.heroImages[this.activeHeroIndex].linkType = type;
    this.heroImages[this.activeHeroIndex].linkId = undefined;
    if (type === 'product') {
      this.productSearchTerm$.next('');
    }
    this.bannerForm.markAsDirty();
  }

  updateLinkId(id: string): void {
    this.heroImages[this.activeHeroIndex].linkId = id;
    this.bannerForm.markAsDirty();
  }

  onProductSearch(term: string): void {
    this.productSearchTerm$.next(term);
  }

  async onSubmit(): Promise<void> {
    if (this.heroImages.length === 0) {
      this.sweetAlertService.error(
        'Imágenes requeridas',
        'Debes agregar al menos una imagen al carrusel hero.'
      );
      return;
    }
    if (this.bannerForm.invalid) {
      this.bannerForm.markAllAsTouched();
      this.sweetAlertService.error(
        'Formulario Inválido',
        'Por favor revisa los campos marcados en rojo.'
      );
      return;
    }
    this.isSubmitting = true;
    try {
      this.carouselSettings = this.carouselSettingsGroup.value;
      const contentData: HeroBanner = {
        ...this.bannerForm.value,
        heroImages: this.heroImages,
        carouselSettings: this.carouselSettings,
        lastUpdated: new Date(),
      };
      await this.homeContentService.saveHomePageContent(
        contentData,
        null,
        this.selectedCategoryFiles,
        this.selectedHeroFiles
      );
      this.sweetAlertService.success('¡Éxito!', 'La configuración de la Home ha sido guardada.');
      this.selectedCategoryFiles.fill(null);
      this.categoryPreviewUrls.fill(null);
      this.selectedHeroFiles = [];
      this.bannerForm.markAsPristine();
    } catch (error) {
      console.error('Error saving home page content:', error);
      this.sweetAlertService.error('Error', 'No se pudo guardar la configuración.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
