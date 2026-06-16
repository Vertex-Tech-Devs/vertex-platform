import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, docData } from '@angular/fire/firestore';
import { doc, setDoc } from 'firebase/firestore';
import type { DocumentReference, DocumentData, SetOptions } from 'firebase/firestore';
import { Functions } from '@angular/fire/functions';
import type { Functions as FirebaseFunctions } from 'firebase/functions';
import { httpsCallable } from 'firebase/functions';
import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { EmailSettings, EmailTemplate } from '@core/models/email-settings.model';
import { tenantPath } from '@core/utils/tenant';

export interface AdvancedTestEmailPayload {
  recipientEmail: string;
  testData: {
    orderId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    totalAmount: string;
  };
  templates: {
    adminNotification?: EmailTemplate;
    customerConfirmation?: EmailTemplate;
  };
}

@Injectable({
  providedIn: 'root',
})
export class EmailSettingsService {
  private firestore: Firestore = inject(Firestore);
  private functions: FirebaseFunctions = inject(Functions);
  private injector = inject(Injector);
  protected getDocRef(path: string, ...segments: string[]): DocumentReference<DocumentData> {
    return doc(this.firestore, path, ...segments);
  }

  protected getDocData(
    ref: DocumentReference<DocumentData>
  ): Observable<EmailSettings | undefined> {
    return docData(ref) as Observable<EmailSettings | undefined>;
  }

  protected setDocData(
    ref: DocumentReference<DocumentData>,
    data: EmailSettings,
    options?: SetOptions
  ): Promise<void> {
    if (options) {
      return setDoc(ref, data, options);
    }
    return setDoc(ref, data);
  }

  protected callFunction(name: string, payload: AdvancedTestEmailPayload): Promise<unknown> {
    const fn = httpsCallable(this.functions, name);
    return fn(payload);
  }

  private get docRef(): DocumentReference<DocumentData> {
    return this.getDocRef(tenantPath('settings'), 'emailTemplates');
  }

  getEmailSettings(): Observable<EmailSettings | undefined> {
    return runInInjectionContext(this.injector, () => {
      return this.getDocData(this.docRef).pipe(
        catchError((err) => {
          console.warn('Unable to load email settings:', err);
          return of(undefined);
        })
      );
    });
  }

  saveEmailSettings(settings: EmailSettings): Promise<void> {
    return this.setDocData(this.docRef, settings, { merge: true });
  }

  sendAdvancedTestEmail(payload: AdvancedTestEmailPayload): Promise<unknown> {
    return this.callFunction('sendAdvancedTestEmail', payload);
  }
}
