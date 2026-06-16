import { TestBed } from '@angular/core/testing';
import { PaymentService } from './payment.service';
import { Functions } from '@angular/fire/functions';

describe('PaymentService', () => {
  let service: PaymentService;
  let functionsSpy: jasmine.SpyObj<Functions>;

  beforeEach(() => {
    functionsSpy = jasmine.createSpyObj('Functions', ['type']);

    TestBed.configureTestingModule({
      providers: [PaymentService, { provide: Functions, useValue: functionsSpy }],
    });

    service = TestBed.inject(PaymentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should resolve immediately if the promise-returning function succeeds on first try', async () => {
    const mockFn = jasmine.createSpy('mockFn').and.returnValue(Promise.resolve('Success'));

    const privateService = service as unknown as {
      retryWithBackoff<T>(fn: () => Promise<T>, retries?: number, delay?: number): Promise<T>;
    };

    const result = await privateService.retryWithBackoff(mockFn);

    expect(result).toBe('Success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry and eventually resolve if the function fails first but then succeeds', async () => {
    let callCount = 0;
    const mockFn = jasmine.createSpy('mockFn').and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Transient Network Error'));
      }
      return Promise.resolve('Success after retry');
    });

    const privateService = service as unknown as {
      retryWithBackoff<T>(fn: () => Promise<T>, retries?: number, delay?: number): Promise<T>;
    };

    // Use a very small delay (1ms) for test execution speed
    const result = await privateService.retryWithBackoff(mockFn, 3, 1);

    expect(result).toBe('Success after retry');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should fail and throw an error after all retries are exhausted', async () => {
    const mockFn = jasmine
      .createSpy('mockFn')
      .and.returnValue(Promise.reject(new Error('Persistent Error')));

    const privateService = service as unknown as {
      retryWithBackoff<T>(fn: () => Promise<T>, retries?: number, delay?: number): Promise<T>;
    };

    try {
      await privateService.retryWithBackoff(mockFn, 2, 1);
      fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toBe('Persistent Error');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }
  });
});
