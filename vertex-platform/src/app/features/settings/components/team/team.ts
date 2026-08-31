import type { OnInit } from '@angular/core';
import { errorMessage } from '@core/utils/error.util';
import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminsService, type AdminInfo } from '@core/services/admins';
import { AuthService } from '@core/services/auth';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team implements OnInit {
  readonly adminsService = inject(AdminsService);
  readonly auth = inject(AuthService);

  readonly newEmail = signal('');
  readonly newRole = signal<'superAdmin' | 'platformAdmin'>('platformAdmin');
  readonly isAdding = signal(false);
  readonly addError = signal('');
  readonly removingUid = signal<string | null>(null);
  readonly resendingEmail = signal<string | null>(null);
  readonly copiedEmail = signal<string | null>(null);

  readonly activeAdmins = computed<AdminInfo[]>(() =>
    this.adminsService
      .admins()
      .filter((a) => !a.pending && !a.uid.startsWith('invited-')),
  );

  readonly pendingAdmins = computed<AdminInfo[]>(() =>
    this.adminsService
      .admins()
      .filter((a) => a.pending === true || a.uid.startsWith('invited-')),
  );

  readonly superAdminsCount = computed(
    () => this.adminsService.admins().filter((a) => a.role === 'superAdmin').length,
  );

  readonly platformAdminsCount = computed(
    () => this.adminsService.admins().filter((a) => a.role !== 'superAdmin').length,
  );

  ngOnInit(): void {
    void this.adminsService.loadAdmins();
  }

  /** Type-safe input value extractor for templates */
  iv(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async addAdmin(): Promise<void> {
    const email = this.newEmail().trim().toLowerCase();
    if (!email) {
      return;
    }
    this.isAdding.set(true);
    this.addError.set('');
    try {
      await this.adminsService.addAdmin(email, this.newRole());
      this.newEmail.set('');
      this.newRole.set('platformAdmin');
    } catch (err: unknown) {
      this.addError.set(errorMessage(err, 'Error al agregar administrador.'));
    } finally {
      this.isAdding.set(false);
    }
  }

  async resendInvite(email: string): Promise<void> {
    this.resendingEmail.set(email);
    try {
      await this.adminsService.resendInvite(email);
    } catch (err: unknown) {
      this.addError.set(errorMessage(err, 'Error al reenviar invitación.'));
    } finally {
      this.resendingEmail.set(null);
    }
  }

  async removeAdmin(uid: string, email: string): Promise<void> {
    if (email === this.auth.user()?.email) {
      this.addError.set('No podés eliminarte a vos mismo.');
      return;
    }
    this.removingUid.set(uid);
    try {
      await this.adminsService.removeAdmin(email);
    } catch (err: unknown) {
      this.addError.set(errorMessage(err, 'Error al eliminar administrador.'));
    } finally {
      this.removingUid.set(null);
    }
  }

  copyEmail(email: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(email);
      this.copiedEmail.set(email);
      this.adminsService.showToast(`Email copiado: ${email}`);
      setTimeout(() => {
        if (this.copiedEmail() === email) {
          this.copiedEmail.set(null);
        }
      }, 3000);
    }
  }
}
