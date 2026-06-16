import { Injectable, inject } from '@angular/core';
import { Storage } from '@angular/fire/storage';
import type { StorageReference, UploadTask, UploadTaskSnapshot } from 'firebase/storage';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SweetAlertService } from './sweet-alert.service';

export interface Upload {
  progress$: Observable<number>;
  downloadUrl$: Observable<string>;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly storage: Storage = inject(Storage);
  private sweetAlertService = inject(SweetAlertService);

  protected getStorageRef(path: string): StorageReference {
    return ref(this.storage, path);
  }

  protected uploadBytes(storageRef: StorageReference, file: File): UploadTask {
    return uploadBytesResumable(storageRef, file);
  }

  protected async getDownloadUrl(taskRef: StorageReference): Promise<string> {
    return getDownloadURL(taskRef);
  }

  protected async deleteStorageObject(storageRef: StorageReference): Promise<void> {
    return deleteObject(storageRef);
  }

  uploadFile(file: File, path: string): Upload {
    const filePath = `${path}/${Date.now()}_${file.name}`;

    const storageRef = this.getStorageRef(filePath);
    const uploadTask = this.uploadBytes(storageRef, file);

    const progress$ = new Observable<number>((observer) => {
      const unsubscribe = uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next(progress);
        },
        (error) => observer.error(error),
        () => observer.complete()
      );
      return (): void => {
        unsubscribe();
      };
    });

    const downloadUrl$ = new Observable<string>((observer) => {
      uploadTask
        .then((snapshot) => {
          this.getDownloadUrl(snapshot.ref)
            .then((url) => {
              observer.next(url);
              observer.complete();
            })
            .catch((error) => observer.error(error));
        })
        .catch((error) => observer.error(error));
    });

    return { progress$, downloadUrl$ };
  }

  deleteFileByUrl(imageUrl: string): Observable<void> {
    try {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.hostname !== 'firebasestorage.googleapis.com') {
        return from(Promise.resolve());
      }
    } catch {
      return from(Promise.resolve());
    }

    const imageRef = this.getStorageRef(imageUrl);
    return from(this.deleteStorageObject(imageRef)).pipe(
      catchError((error) => {
        if (error.code === 'storage/object-not-found') {
          console.warn(
            `El archivo en la URL ${imageUrl} no se encontró. Pudo haber sido eliminado previamente.`
          );
          return from(Promise.resolve());
        }
        console.error('Error al eliminar la imagen:', error);
        this.sweetAlertService.error('Error de Borrado', 'No se pudo eliminar la imagen anterior.');
        return throwError(() => error);
      })
    );
  }
}
