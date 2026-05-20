import { Injectable, signal } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface AdminInfo {
  uid: string;
  email: string;
  displayName: string | undefined;
  photoURL: string | undefined;
}

@Injectable({ providedIn: 'root' })
export class AdminsService {
  private fns = getFunctions();

  readonly admins = signal<AdminInfo[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

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

  async addAdmin(email: string): Promise<void> {
    const manageAdmin = httpsCallable(this.fns, 'manageAdmin');
    await manageAdmin({ email, action: 'add' });
    await this.loadAdmins();
  }

  async removeAdmin(email: string): Promise<void> {
    const manageAdmin = httpsCallable(this.fns, 'manageAdmin');
    await manageAdmin({ email, action: 'remove' });
    await this.loadAdmins();
  }
}
