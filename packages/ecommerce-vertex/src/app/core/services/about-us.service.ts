import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, docData } from '@angular/fire/firestore';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { DocumentReference, DocumentData } from 'firebase/firestore';
import type { Observable } from 'rxjs';
import { from, of } from 'rxjs';
import { firstValueFrom, switchMap, catchError } from 'rxjs';
import { map } from 'rxjs/operators';
import type { AboutUsData } from '@core/models/about-us.model';
import { StorageService } from './storage.service';
import { convertTimestampsToDates } from '@core/utils/date-converter';
import { tenantPath } from '@core/utils/tenant';

@Injectable({
  providedIn: 'root',
})
export class AboutUsService {
  private firestore: Firestore = inject(Firestore);
  private storageService = inject(StorageService);
  private injector = inject(Injector);

  private get docRef(): DocumentReference<DocumentData> {
    return doc(this.firestore, tenantPath('pages'), 'aboutUs');
  }

  getAboutUsData(): Observable<AboutUsData | undefined> {
    return runInInjectionContext(this.injector, () => {
      const tenantRef = this.docRef;
      const legacyRef = doc(this.firestore, 'pages', 'aboutUs');
      return from(getDoc(tenantRef)).pipe(
        switchMap((snap) =>
          snap.exists()
            ? (docData(tenantRef) as Observable<AboutUsData | undefined>)
            : (docData(legacyRef) as Observable<AboutUsData | undefined>)
        ),
        map((data) => convertTimestampsToDates(data) as AboutUsData | undefined),
        catchError((err) => {
          console.warn('Unable to load about us data:', err);
          return of(undefined);
        })
      );
    });
  }

  async saveAboutUsData(
    data: AboutUsData,
    bannerFile: File | null,
    centralFile: File | null
  ): Promise<void> {
    const dataToSave = { ...data };

    if (bannerFile) {
      const path = `pages/about-us/banner_${Date.now()}_${bannerFile.name}`;
      if (dataToSave.bannerImageUrl) {
        await firstValueFrom(this.storageService.deleteFileByUrl(dataToSave.bannerImageUrl));
      }
      const upload = this.storageService.uploadFile(bannerFile, path);
      dataToSave.bannerImageUrl = await firstValueFrom(upload.downloadUrl$);
    }

    if (centralFile) {
      const path = `pages/about-us/central_${Date.now()}_${centralFile.name}`;
      if (dataToSave.centralImageUrl) {
        await firstValueFrom(this.storageService.deleteFileByUrl(dataToSave.centralImageUrl));
      }
      const upload = this.storageService.uploadFile(centralFile, path);
      dataToSave.centralImageUrl = await firstValueFrom(upload.downloadUrl$);
    }

    return setDoc(this.docRef, dataToSave, { merge: true });
  }
}
