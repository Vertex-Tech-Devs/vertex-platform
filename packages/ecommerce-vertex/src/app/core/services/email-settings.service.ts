import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, docData } from '@angular/fire/firestore';
import { doc, setDoc } from 'firebase/firestore';
import type { DocumentReference, DocumentData } from 'firebase/firestore';
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
  private get docRef(): DocumentReference<DocumentData> {
    return doc(this.firestore, tenantPath('settings'), 'emailTemplates');
  }

  getEmailSettings(): Observable<EmailSettings | undefined> {
    return runInInjectionContext(this.injector, () => {
      return (docData(this.docRef) as Observable<EmailSettings | undefined>).pipe(
        catchError((err) => {
          console.warn('Unable to load email settings:', err);
          return of(undefined);
        })
      );
    });
  }

  saveEmailSettings(settings: EmailSettings): Promise<void> {
    return setDoc(this.docRef, settings, { merge: true });
  }

  sendAdvancedTestEmail(payload: AdvancedTestEmailPayload): Promise<unknown> {
    const sendTestEmailFn = httpsCallable(this.functions, 'sendAdvancedTestEmail');
    return sendTestEmailFn(payload);
  }
}
