import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Team } from './team';
import { AdminsService, type AdminInfo } from '@core/services/admins';
import { AuthService } from '@core/services/auth';

describe('Team Component', () => {
  let component: Team;
  let fixture: ComponentFixture<Team>;

  const mockAdmins = signal<AdminInfo[]>([
    {
      uid: 'u1',
      email: 'juan@vertex.com',
      displayName: 'Juan',
      photoURL: undefined,
      role: 'superAdmin',
      status: 'active',
      pending: false,
    },
    {
      uid: 'invited-carlos@vertex.com',
      email: 'carlos@vertex.com',
      displayName: 'Invitado (Pendiente)',
      photoURL: undefined,
      role: 'platformAdmin',
      status: 'pending',
      pending: true,
    },
  ]);

  const mockAdminsService = {
    admins: mockAdmins,
    isLoading: signal(false),
    error: signal<string | null>(null),
    toastMessage: signal<string | null>(null),
    loadAdmins: vi.fn().mockResolvedValue(undefined),
    addAdmin: vi.fn().mockResolvedValue(undefined),
    resendInvite: vi.fn().mockResolvedValue(undefined),
    removeAdmin: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
  };

  const mockAuthService = {
    user: signal<{ email: string } | null>({ email: 'juan@vertex.com' }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAdmins.set([
      {
        uid: 'u1',
        email: 'juan@vertex.com',
        displayName: 'Juan',
        photoURL: undefined,
        role: 'superAdmin',
        status: 'active',
        pending: false,
      },
      {
        uid: 'invited-carlos@vertex.com',
        email: 'carlos@vertex.com',
        displayName: 'Invitado (Pendiente)',
        photoURL: undefined,
        role: 'platformAdmin',
        status: 'pending',
        pending: true,
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [Team],
      providers: [
        provideRouter([]),
        { provide: AdminsService, useValue: mockAdminsService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Team);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe inicializar el componente y cargar la lista de administradores', () => {
    expect(component).toBeTruthy();
    expect(mockAdminsService.loadAdmins).toHaveBeenCalled();
  });

  it('calcula correctamente activeAdmins y pendingAdmins', () => {
    expect(component.activeAdmins().length).toBe(1);
    expect(component.activeAdmins()[0].email).toBe('juan@vertex.com');

    expect(component.pendingAdmins().length).toBe(1);
    expect(component.pendingAdmins()[0].email).toBe('carlos@vertex.com');
  });

  it('calcula correctamente superAdminsCount y platformAdminsCount', () => {
    expect(component.superAdminsCount()).toBe(1);
    expect(component.platformAdminsCount()).toBe(1);
  });

  it('agrega un nuevo administrador exitosamente', async () => {
    component.newEmail.set('nuevo@vertex.com');
    component.newRole.set('platformAdmin');

    await component.addAdmin();

    expect(mockAdminsService.addAdmin).toHaveBeenCalledWith('nuevo@vertex.com', 'platformAdmin');
    expect(component.newEmail()).toBe('');
    expect(component.addError()).toBe('');
  });

  it('ignora email vacío al intentar agregar', async () => {
    component.newEmail.set('   ');
    await component.addAdmin();
    expect(mockAdminsService.addAdmin).not.toHaveBeenCalled();
  });

  it('captura error al agregar administrador', async () => {
    mockAdminsService.addAdmin.mockRejectedValueOnce(new Error('Permission denied'));
    component.newEmail.set('error@vertex.com');

    await component.addAdmin();

    expect(component.addError()).toContain('Permission denied');
    expect(component.isAdding()).toBe(false);
  });

  it('reenvia invitación exitosamente', async () => {
    await component.resendInvite('carlos@vertex.com');

    expect(mockAdminsService.resendInvite).toHaveBeenCalledWith('carlos@vertex.com');
    expect(component.resendingEmail()).toBe(null);
  });

  it('no permite eliminarse a uno mismo', async () => {
    await component.removeAdmin('u1', 'juan@vertex.com');

    expect(mockAdminsService.removeAdmin).not.toHaveBeenCalled();
    expect(component.addError()).toBe('No podés eliminarte a vos mismo.');
  });

  it('elimina a otro administrador exitosamente', async () => {
    await component.removeAdmin('invited-carlos@vertex.com', 'carlos@vertex.com');

    expect(mockAdminsService.removeAdmin).toHaveBeenCalledWith('carlos@vertex.com');
    expect(component.removingUid()).toBe(null);
  });

  it('copia el email al portapapeles', () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    component.copyEmail('juan@vertex.com');

    expect(writeTextSpy).toHaveBeenCalledWith('juan@vertex.com');
    expect(component.copiedEmail()).toBe('juan@vertex.com');
    expect(mockAdminsService.showToast).toHaveBeenCalledWith('Email copiado: juan@vertex.com');
  });
});
