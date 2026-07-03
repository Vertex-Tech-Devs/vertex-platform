import type { OnInit } from '@angular/core';
import { errorMessage } from '@core/utils/error.util';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminsService } from '@core/services/admins';
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

  /** Type-safe input value extractor for templates */
  iv(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /** Handle role select change — properly typed for strict union signals */
  onRoleChange(event: Event): void {
    this.newRole.set((event.target as HTMLSelectElement).value as 'superAdmin' | 'platformAdmin');
  }

  readonly newEmail = signal('');
  readonly newRole = signal<'superAdmin' | 'platformAdmin'>('platformAdmin');
  readonly isAdding = signal(false);
  readonly addError = signal('');
  readonly removingUid = signal<string | null>(null);

  ngOnInit(): void {
    void this.adminsService.loadAdmins();
  }

  async addAdmin(): Promise<void> {
    const email = this.newEmail().trim();
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
      this.addError.set(errorMessage(err, 'Error al agregar admin.'));
    } finally {
      this.isAdding.set(false);
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
    } finally {
      this.removingUid.set(null);
    }
  }
}
