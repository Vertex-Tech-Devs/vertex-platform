import { TestBed } from '@angular/core/testing';
import { AdminsService, type AdminInfo } from './admins';
import { httpsCallable } from 'firebase/functions';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn().mockReturnValue({}),
  httpsCallable: vi.fn(),
}));

describe('AdminsService', () => {
  let service: AdminsService;
  const mockHttpsCallable = vi.mocked(httpsCallable);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [AdminsService],
    });

    service = TestBed.inject(AdminsService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created and initialized with empty state', () => {
    expect(service).toBeTruthy();
    expect(service.admins()).toEqual([]);
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.toastMessage()).toBeNull();
  });

  it('should show toast message and clear it after timeout', () => {
    service.showToast('Test Toast');
    expect(service.toastMessage()).toBe('Test Toast');

    vi.advanceTimersByTime(4000);
    expect(service.toastMessage()).toBeNull();
  });

  it('should load admins successfully', async () => {
    const mockAdmins: AdminInfo[] = [
      {
        uid: 'admin-1',
        email: 'admin1@vertex.com',
        displayName: 'Admin 1',
        photoURL: undefined,
        role: 'superAdmin',
        status: 'active',
      },
      {
        uid: 'admin-2',
        email: 'admin2@vertex.com',
        displayName: 'Admin 2',
        photoURL: undefined,
        role: 'platformAdmin',
        status: 'pending',
      },
    ];

    const callableFn = vi.fn().mockResolvedValue({ data: { admins: mockAdmins } });
    mockHttpsCallable.mockReturnValue(callableFn as unknown as ReturnType<typeof httpsCallable>);

    await service.loadAdmins();

    expect(service.admins()).toEqual(mockAdmins);
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should handle load admins error gracefully', async () => {
    const callableFn = vi.fn().mockRejectedValue(new Error('Permission denied'));
    mockHttpsCallable.mockReturnValue(callableFn as unknown as ReturnType<typeof httpsCallable>);

    await service.loadAdmins();

    expect(service.admins()).toEqual([]);
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBe('Permission denied');
  });

  it('should handle load admins non-Error exception', async () => {
    const callableFn = vi.fn().mockRejectedValue('Unknown error string');
    mockHttpsCallable.mockReturnValue(callableFn as unknown as ReturnType<typeof httpsCallable>);

    await service.loadAdmins();

    expect(service.error()).toBe('Error al cargar admins.');
  });

  it('should add admin and reload admin list', async () => {
    const callableFn = vi.fn().mockResolvedValue({ data: { success: true, admins: [] } });
    mockHttpsCallable.mockReturnValue(callableFn as unknown as ReturnType<typeof httpsCallable>);

    await service.addAdmin('newadmin@vertex.com', 'superAdmin');

    expect(mockHttpsCallable).toHaveBeenCalled();
    expect(service.toastMessage()).toContain('newadmin@vertex.com');
  });

  it('should resend invite and fallback to manageAdmin if resendAdminInvite fails', async () => {
    const resendFailed = vi.fn().mockRejectedValue(new Error('resend failed'));
    const manageSuccess = vi.fn().mockResolvedValue({ data: { success: true, admins: [] } });

    mockHttpsCallable
      .mockReturnValueOnce(resendFailed as unknown as ReturnType<typeof httpsCallable>)
      .mockReturnValueOnce(manageSuccess as unknown as ReturnType<typeof httpsCallable>)
      .mockReturnValue(manageSuccess as unknown as ReturnType<typeof httpsCallable>);

    await service.resendInvite('invite@vertex.com');

    expect(service.toastMessage()).toContain('invite@vertex.com');
  });

  it('should resend invite successfully when resendAdminInvite succeeds', async () => {
    const resendSuccess = vi.fn().mockResolvedValue({ data: { success: true, admins: [] } });
    mockHttpsCallable.mockReturnValue(resendSuccess as unknown as ReturnType<typeof httpsCallable>);

    await service.resendInvite('invite@vertex.com');

    expect(service.toastMessage()).toContain('invite@vertex.com');
  });

  it('should remove admin and reload admin list', async () => {
    const callableFn = vi.fn().mockResolvedValue({ data: { success: true, admins: [] } });
    mockHttpsCallable.mockReturnValue(callableFn as unknown as ReturnType<typeof httpsCallable>);

    await service.removeAdmin('remove@vertex.com');

    expect(mockHttpsCallable).toHaveBeenCalled();
    expect(service.toastMessage()).toContain('remove@vertex.com');
  });
});
