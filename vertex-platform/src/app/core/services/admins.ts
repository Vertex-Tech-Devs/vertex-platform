import { Injectable, signal } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface AdminInfo {
  uid: string;
  email: string;
  displayName: string | undefined;
  photoURL: string | undefined;
  role?: 'superAdmin' | 'platformAdmin';
  status?: 'active' | 'pending';
  pending?: boolean;
  addedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminsService {
  private fns = getFunctions();

  readonly admins = signal<AdminInfo[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }

  async loadAdmins(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const listAdmins = httpsCallable<void, { admins: AdminInfo[] }>(this.fns, 'listAdmins');
      const result = await listAdmins();
      this.admins.set(result.data.admins);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Error al cargar admins.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addAdmin(
    email: string,
    role: 'superAdmin' | 'platformAdmin' = 'platformAdmin',
  ): Promise<void> {
    const manageAdmin = httpsCallable(this.fns, 'manageAdmin');
    await manageAdmin({ email, action: 'add', role });
    await this.loadAdmins();
    this.showToast(`Administrador ${email} invitado exitosamente`);
  }

  async resendInvite(email: string): Promise<void> {
    try {
      const resendFn = httpsCallable<{ email: string }, { success: boolean }>(
        this.fns,
        'resendAdminInvite',
      );
      await resendFn({ email });
    } catch {
      // Fallback: re-add pre-authorization
      const manageAdmin = httpsCallable(this.fns, 'manageAdmin');
      await manageAdmin({ email, action: 'add' });
    }
    await this.loadAdmins();
    this.showToast(`Invitación reenviada con éxito a ${email}`);
  }

  async removeAdmin(email: string): Promise<void> {
    const manageAdmin = httpsCallable(this.fns, 'manageAdmin');
    await manageAdmin({ email, action: 'remove' });
    await this.loadAdmins();
    this.showToast(`Acceso revocado para ${email}`);
  }
}
