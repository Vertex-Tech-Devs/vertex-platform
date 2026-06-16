import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with isLoading = false', () => {
    expect(service.isLoading()).toBeFalse();
  });

  it('should set isLoading to true when show() is called', () => {
    service.show();
    expect(service.isLoading()).toBeTrue();
  });

  it('should set isLoading to false when hide() is called', () => {
    service.show();
    service.hide();
    expect(service.isLoading()).toBeFalse();
  });

  it('should allow multiple show/hide cycles', () => {
    service.show();
    expect(service.isLoading()).toBeTrue();
    service.hide();
    expect(service.isLoading()).toBeFalse();
    service.show();
    expect(service.isLoading()).toBeTrue();
  });

  it('should expose a readonly signal', () => {
    // isLoading is the asReadonly() projection — calling set() on it should not exist
    expect(typeof (service.isLoading as unknown as { set?: unknown }).set).toBe('undefined');
  });
});
