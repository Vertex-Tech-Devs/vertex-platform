import { Injectable, inject } from '@angular/core';
import { ImageValidationService } from '@core/services/image-validation.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';

export interface HeroImageBatch {
  ids: string[];
  previews: string[];
  files: File[];
}

const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const ALLOWED_EXTS = ['.webp', '.jpg', '.jpeg', '.png'];
export const MAX_HERO_IMAGES = 5;

@Injectable({ providedIn: 'root' })
export class HeroImageUploaderService {
  private imageValidationService = inject(ImageValidationService);
  private sweetAlertService = inject(SweetAlertService);

  isValidFile(file: File): boolean {
    return (
      ALLOWED_TYPES.includes(file.type) ||
      ALLOWED_EXTS.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  }

  async processFiles(event: Event, currentCount: number): Promise<HeroImageBatch | null> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return null;
    }

    const rawFiles = Array.from(input.files);
    const validFiles = rawFiles.filter((f) => {
      if (!this.isValidFile(f)) {
        this.sweetAlertService.error(
          'Formato no permitido',
          `El archivo "${f.name}" no es un formato permitido (WebP, JPG, PNG).`
        );
        return false;
      }
      return true;
    });

    if (currentCount + validFiles.length > MAX_HERO_IMAGES) {
      this.sweetAlertService.error(
        'Límite de imágenes',
        `Máximo ${MAX_HERO_IMAGES} imágenes permitidas. Tienes ${currentCount} actualmente.`
      );
      input.value = '';
      return null;
    }

    const results = await Promise.all(
      validFiles.map(async (file) => ({
        file,
        validation: await this.imageValidationService.validateHeroImage(file),
      }))
    );

    const bad = results.filter((r) => !r.validation.valid);
    const good = results.filter((r) => r.validation.valid).map((r) => r.file);

    if (bad.length > 0) {
      const recs = this.imageValidationService.getQualityRecommendations();
      const msg =
        bad
          .map(
            (item) =>
              `📷 ${item.file.name}\n${item.validation.errors.map((e) => `  • ${e}`).join('\n')}`
          )
          .join('\n\n') +
        `\n\nRecomendaciones:\n✓ Resolución ideal: ${recs.idealResolution}\n✓ Proporción: 16:9\n✓ Tamaño máximo: 2MB\n\n¿Deseas continuar de todas formas?`;
      const ok = await this.sweetAlertService.confirm(
        '⚠️ Imágenes de Baja Calidad',
        msg,
        'warning'
      );
      if (!ok) {
        input.value = '';
        return null;
      }
      good.push(...bad.map((item) => item.file));
    }

    const filesToAdd = good.length > 0 ? good : validFiles;
    if (!filesToAdd.length) {
      input.value = '';
      return null;
    }

    return new Promise<HeroImageBatch>((resolve) => {
      const batch: HeroImageBatch = { ids: [], previews: [], files: [] };
      let loaded = 0;
      filesToAdd.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (): void => {
          batch.ids.push(`file-${Date.now()}-${index}`);
          batch.previews.push(reader.result as string);
          batch.files.push(file);
          loaded++;
          if (loaded === filesToAdd.length) {
            input.value = '';
            resolve(batch);
          }
        };
        reader.readAsDataURL(file);
      });
    });
  }
}
