import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { Storage } from '@angular/fire/storage';
import { SweetAlertService } from './sweet-alert.service';
import type { StorageReference, UploadTask, UploadTaskSnapshot } from 'firebase/storage';

interface StorageServiceWithPrivates {
  getStorageRef: (path: string) => StorageReference;
  uploadBytes: (storageRef: StorageReference, file: File) => UploadTask;
  getDownloadUrl: (taskRef: StorageReference) => Promise<string>;
  deleteStorageObject: (storageRef: StorageReference) => Promise<void>;
}

describe('StorageService', () => {
  let service: StorageService;
  let storageSpy: jasmine.SpyObj<Storage>;
  let sweetAlertSpy: jasmine.SpyObj<SweetAlertService>;

  beforeEach(() => {
    storageSpy = jasmine.createSpyObj('Storage', ['type']);
    sweetAlertSpy = jasmine.createSpyObj('SweetAlertService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: Storage, useValue: storageSpy },
        { provide: SweetAlertService, useValue: sweetAlertSpy },
      ],
    });

    service = TestBed.inject(StorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload file and return progress and download url', (done) => {
    const mockFile = new File(['foo'], 'foo.txt', { type: 'text/plain' });
    const mockRef = {} as unknown as StorageReference;
    const mockUploadTask = {
      on: jasmine
        .createSpy('on')
        .and.callFake(
          (
            _event: string,
            next: (snapshot: UploadTaskSnapshot) => void,
            _error: (err: unknown) => void,
            complete: () => void
          ): (() => void) => {
            next({ bytesTransferred: 50, totalBytes: 100 } as unknown as UploadTaskSnapshot);
            next({ bytesTransferred: 100, totalBytes: 100 } as unknown as UploadTaskSnapshot);
            complete();
            return (): void => {};
          }
        ),
      then: jasmine
        .createSpy('then')
        .and.callFake(
          (resolve: (snapshot: { ref: StorageReference }) => Promise<unknown> | void) => {
            void resolve({ ref: mockRef });
            return Promise.resolve({ ref: mockRef } as unknown as UploadTaskSnapshot);
          }
        ),
    } as unknown as UploadTask;

    const privSvc = service as unknown as StorageServiceWithPrivates;
    spyOn(privSvc, 'getStorageRef').and.returnValue(mockRef);
    spyOn(privSvc, 'uploadBytes').and.returnValue(mockUploadTask);
    spyOn(privSvc, 'getDownloadUrl').and.returnValue(Promise.resolve('https://mock.url/foo.txt'));

    const upload = service.uploadFile(mockFile, 'test-path');

    let lastProgress = 0;
    upload.progress$.subscribe({
      next: (prog) => {
        lastProgress = prog;
      },
      complete: () => {
        expect(lastProgress).toBe(100);
      },
    });

    upload.downloadUrl$.subscribe({
      next: (url) => {
        expect(url).toBe('https://mock.url/foo.txt');
        done();
      },
    });
  });

  it('should handle invalid URLs in deleteFileByUrl', (done) => {
    service.deleteFileByUrl('invalid-url').subscribe(() => {
      expect(true).toBeTrue();
      done();
    });
  });

  it('should handle non-firebase URLs in deleteFileByUrl', (done) => {
    service.deleteFileByUrl('https://example.com/foo.png').subscribe(() => {
      expect(true).toBeTrue();
      done();
    });
  });

  it('should delete file by URL successfully', (done) => {
    const mockRef = {} as unknown as StorageReference;
    const privSvc = service as unknown as StorageServiceWithPrivates;
    spyOn(privSvc, 'getStorageRef').and.returnValue(mockRef);
    spyOn(privSvc, 'deleteStorageObject').and.returnValue(Promise.resolve());

    service
      .deleteFileByUrl('https://firebasestorage.googleapis.com/v0/b/bucket/o/foo.png')
      .subscribe(() => {
        expect(privSvc.deleteStorageObject).toHaveBeenCalledWith(mockRef);
        done();
      });
  });

  it('should handle not found error gracefully on deleteFileByUrl', (done) => {
    const mockRef = {} as unknown as StorageReference;
    const privSvc = service as unknown as StorageServiceWithPrivates;
    spyOn(privSvc, 'getStorageRef').and.returnValue(mockRef);
    spyOn(privSvc, 'deleteStorageObject').and.returnValue(
      Promise.reject({ code: 'storage/object-not-found' })
    );

    service
      .deleteFileByUrl('https://firebasestorage.googleapis.com/v0/b/bucket/o/foo.png')
      .subscribe(() => {
        expect(true).toBeTrue();
        done();
      });
  });

  it('should handle delete error and trigger sweet alert error', (done) => {
    const mockRef = {} as unknown as StorageReference;
    const privSvc = service as unknown as StorageServiceWithPrivates;
    spyOn(privSvc, 'getStorageRef').and.returnValue(mockRef);
    spyOn(privSvc, 'deleteStorageObject').and.returnValue(
      Promise.reject({ code: 'storage/unknown' })
    );

    service
      .deleteFileByUrl('https://firebasestorage.googleapis.com/v0/b/bucket/o/foo.png')
      .subscribe({
        error: (_err) => {
          expect(sweetAlertSpy.error).toHaveBeenCalled();
          done();
        },
      });
  });
});
