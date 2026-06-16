import { TestBed } from '@angular/core/testing';
import Swal from 'sweetalert2';
import { SweetAlertService } from './sweet-alert.service';

describe('SweetAlertService', () => {
  let service: SweetAlertService;
  let fireSpy: jasmine.Spy;
  let closeSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SweetAlertService);

    fireSpy = spyOn(Swal, 'fire').and.returnValue(
      Promise.resolve({ isConfirmed: false, isDenied: false, isDismissed: true })
    );
    closeSpy = spyOn(Swal, 'close');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('success() should call Swal.fire with success icon', () => {
    service.success('Title', 'Message');
    expect(fireSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ icon: 'success', title: 'Title', text: 'Message' })
    );
  });

  it('error() should call Swal.fire with error icon', () => {
    service.error('Error title', 'Error msg');
    expect(fireSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ icon: 'error', title: 'Error title', text: 'Error msg' })
    );
  });

  it('warning() should call Swal.fire with warning icon', () => {
    service.warning('Warn', 'Be careful');
    expect(fireSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ icon: 'warning', title: 'Warn', text: 'Be careful' })
    );
  });

  it('confirm() should resolve true when user confirms', async () => {
    fireSpy.and.returnValue(
      Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false })
    );
    const result = await service.confirm('Sure?', 'This is irreversible');
    expect(result).toBeTrue();
    expect(fireSpy).toHaveBeenCalledWith(jasmine.objectContaining({ showCancelButton: true }));
  });

  it('confirm() should resolve false when user cancels', async () => {
    fireSpy.and.returnValue(
      Promise.resolve({ isConfirmed: false, isDenied: false, isDismissed: true })
    );
    const result = await service.confirm('Sure?', 'This is irreversible');
    expect(result).toBeFalse();
  });

  it('confirm() should use provided icon', async () => {
    await service.confirm('Sure?', 'Text', 'error');
    expect(fireSpy).toHaveBeenCalledWith(jasmine.objectContaining({ icon: 'error' }));
  });

  it('loading() should call Swal.fire with loading config', () => {
    service.loading('Loading…', 'Please wait');
    expect(fireSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        title: 'Loading…',
        text: 'Please wait',
        allowOutsideClick: false,
      })
    );
  });

  it('loading() should work without text parameter', () => {
    service.loading('Processing…');
    expect(fireSpy).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'Processing…' }));
  });

  it('loading() should invoke didOpen and call Swal.showLoading', () => {
    const showLoadingSpy = spyOn(Swal, 'showLoading');
    fireSpy.and.callFake((config: { didOpen?: () => void }) => {
      config.didOpen?.();
      return Promise.resolve({ isConfirmed: false, isDenied: false, isDismissed: true });
    });

    service.loading('Processing…');

    expect(showLoadingSpy).toHaveBeenCalled();
  });

  it('close() should call Swal.close', () => {
    service.close();
    expect(closeSpy).toHaveBeenCalled();
  });
});
