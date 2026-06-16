import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, docData } from '@angular/fire/firestore';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { Observable } from 'rxjs';
import { from, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs';
import type { FooterData } from '@core/models/footer.model';
import { tenantPath } from '@core/utils/tenant';

@Injectable({
  providedIn: 'root',
})
export class FooterService {
  private firestore: Firestore = inject(Firestore);
  private injector = inject(Injector);

  getFooterData(): Observable<FooterData | undefined> {
    return runInInjectionContext(this.injector, () => {
      const tenantRef = doc(this.firestore, tenantPath('configuracion'), 'footer');
      const legacyRef = doc(this.firestore, 'configuracion', 'footer');
      return from(getDoc(tenantRef)).pipe(
        switchMap((snap) =>
          snap.exists()
            ? (docData(tenantRef) as Observable<FooterData | undefined>)
            : (docData(legacyRef) as Observable<FooterData | undefined>)
        ),
        catchError((err) => {
          console.warn('Unable to load footer data:', err);
          return of(undefined);
        })
      );
    });
  }

  saveFooterData(data: FooterData): Promise<void> {
    const docRef = doc(this.firestore, tenantPath('configuracion'), 'footer');
    const cleanData = JSON.parse(JSON.stringify(data));
    return setDoc(docRef, cleanData);
  }
}
