import { TestBed } from '@angular/core/testing';
import { ImageValidationService } from './image-validation.service';

/** Create a minimal File-like object with controllable size */
function makeFile(sizeBytes: number, type = 'image/jpeg'): File {
  const arr = new Uint8Array(sizeBytes);
  return new File([arr], 'test.jpg', { type });
}

/** Mock FileReader + Image so getImageDimensions() resolves with given dimensions */
function mockImageDimensions(width: number, height: number): void {
  const mockImg: Partial<HTMLImageElement> & { onload: (() => void) | null } = {
    width,
    height,
    onload: null,
  };
  Object.defineProperty(mockImg, 'src', {
    set(_url: string) {
      mockImg.onload?.();
    },
  });
  spyOn(window as Window & typeof globalThis, 'Image').and.returnValue(
    mockImg as unknown as HTMLImageElement
  );

  const mockReader = {
    onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
    onerror: null as (() => void) | null,
    result: 'data:image/jpeg;base64,test',
    readAsDataURL(_file: Blob): void {
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
    },
  };
  spyOn(window as Window & typeof globalThis, 'FileReader').and.returnValue(
    mockReader as unknown as FileReader
  );
}

/** Mock FileReader to fail (simulates unreadable file) */
function mockFileReaderError(): void {
  const mockReader = {
    onload: null as ((e: ProgressEvent<FileReader>) => void) | null,
    onerror: null as (() => void) | null,
    readAsDataURL(_file: Blob): void {
      this.onerror?.();
    },
  };
  spyOn(window as Window & typeof globalThis, 'FileReader').and.returnValue(
    mockReader as unknown as FileReader
  );
}

describe('ImageValidationService', () => {
  let service: ImageValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getQualityRecommendations()', () => {
    it('should return correct recommendation values', () => {
      const recs = service.getQualityRecommendations();
      expect(recs.idealResolution).toBe('1600x900px');
      expect(recs.minResolution).toBe('1200x675px');
      expect(recs.maxFileSize).toBe('2MB');
      expect(recs.aspectRatio).toBe('16:9');
      expect(recs.formats).toContain('WebP');
    });
  });

  describe('validateHeroImage()', () => {
    it('should return valid for a correct 1600x900 image under 2MB', async () => {
      mockImageDimensions(1600, 900);
      const file = makeFile(500 * 1024); // 500KB

      const result = await service.validateHeroImage(file);

      expect(result.valid).toBeTrue();
      expect(result.errors).toEqual([]);
      expect(result.width).toBe(1600);
      expect(result.height).toBe(900);
      expect(result.fileSize).toBe(500 * 1024);
    });

    it('should add error when file is larger than 2MB', async () => {
      mockImageDimensions(1600, 900);
      const file = makeFile(3 * 1024 * 1024); // 3MB

      const result = await service.validateHeroImage(file);

      expect(result.valid).toBeFalse();
      expect(result.errors.some((e) => e.includes('3.00MB'))).toBeTrue();
    });

    it('should add error when dimensions are below minimum (1200x675)', async () => {
      mockImageDimensions(800, 450); // too small
      const file = makeFile(100 * 1024);

      const result = await service.validateHeroImage(file);

      expect(result.valid).toBeFalse();
      expect(result.errors.some((e) => e.includes('resolución'))).toBeTrue();
    });

    it('should add error when aspect ratio is not 16:9', async () => {
      mockImageDimensions(1200, 800); // 3:2 ratio
      const file = makeFile(100 * 1024);

      const result = await service.validateHeroImage(file);

      expect(result.valid).toBeFalse();
      expect(result.errors.some((e) => e.includes('16:9'))).toBeTrue();
    });

    it('should add dimension error when FileReader fails', async () => {
      mockFileReaderError();
      const file = makeFile(100 * 1024);

      const result = await service.validateHeroImage(file);

      expect(result.valid).toBeFalse();
      expect(result.errors.some((e) => e.includes('dimensiones'))).toBeTrue();
    });

    it('should accumulate both file size and dimension errors', async () => {
      mockImageDimensions(400, 300); // too small AND wrong ratio
      const file = makeFile(3 * 1024 * 1024); // too large

      const result = await service.validateHeroImage(file);

      expect(result.valid).toBeFalse();
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
