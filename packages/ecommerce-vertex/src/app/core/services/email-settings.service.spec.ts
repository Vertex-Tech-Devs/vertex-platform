import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EmailSettingsService } from './email-settings.service';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import type { DocumentReference } from 'firebase/firestore';
import type { EmailSettings } from '@core/models/email-settings.model';

describe('EmailSettingsService', () => {
  let service: EmailSettingsService;
  let firestoreMock: unknown;
  let functionsMock: unknown;

  interface ServiceWithProtectedMethods {
    getDocRef(path: string, ...segments: string[]): DocumentReference;
    getDocData(ref: unknown): unknown;
    setDocData(ref: unknown, data: unknown, options?: unknown): unknown;
    callFunction(name: string, payload: unknown): unknown;
  }

  beforeEach(() => {
    firestoreMock = {};
    functionsMock = {};

    TestBed.configureTestingModule({
      providers: [
        EmailSettingsService,
        { provide: Firestore, useValue: firestoreMock },
        { provide: Functions, useValue: functionsMock },
      ],
    });

    service = TestBed.inject(EmailSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get email settings successfully', (done) => {
    const mockSettings = { templates: {} } as unknown as EmailSettings;
    const testService = service as unknown as ServiceWithProtectedMethods;
    spyOn(testService, 'getDocRef').and.returnValue({} as DocumentReference);
    spyOn(testService, 'getDocData').and.returnValue(of(mockSettings));

    service.getEmailSettings().subscribe((res) => {
      expect(res).toEqual(mockSettings);
      done();
    });
  });

  it('should catch error on getEmailSettings', (done) => {
    const testService = service as unknown as ServiceWithProtectedMethods;
    spyOn(testService, 'getDocRef').and.returnValue({} as DocumentReference);
    spyOn(testService, 'getDocData').and.returnValue(throwError(() => new Error('docData error')));

    service.getEmailSettings().subscribe((res) => {
      expect(res).toBeUndefined();
      done();
    });
  });

  it('should save email settings successfully', async () => {
    const testService = service as unknown as ServiceWithProtectedMethods;
    spyOn(testService, 'getDocRef').and.returnValue({} as DocumentReference);
    const setDocSpy = spyOn(testService, 'setDocData').and.returnValue(Promise.resolve());

    await service.saveEmailSettings({ templates: {} } as unknown as EmailSettings);
    expect(setDocSpy).toHaveBeenCalled();
  });

  it('should send advanced test email successfully', async () => {
    const testService = service as unknown as ServiceWithProtectedMethods;
    const callFnSpy = spyOn(testService, 'callFunction').and.returnValue(
      Promise.resolve({ success: true })
    );

    const payload = {
      recipientEmail: 'test@test.com',
      testData: {
        orderId: '1',
        clientName: 'name',
        clientEmail: 'email',
        clientPhone: 'phone',
        totalAmount: '100',
      },
      templates: {},
    };

    const res = await service.sendAdvancedTestEmail(payload);
    expect(res).toEqual({ success: true });
    expect(callFnSpy).toHaveBeenCalledWith('sendAdvancedTestEmail', payload);
  });
});
