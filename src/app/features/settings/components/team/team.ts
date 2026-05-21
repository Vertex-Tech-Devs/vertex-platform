import type { OnInit } from '@angular/core';
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
  styleUrls: ['./team.scss'],
})
export class Team implements OnInit {
  readonly adminsService = inject(AdminsService);
  readonly auth = inject(AuthService);

  readonly newEmail = signal('');
  readonly isAdding = signal(false);
  readonly addError = signal('');
  readonly removingUid = signal<string | null>(null);

  ngOnInit(): void {
    void this.adminsService.loadAdmins();
  }

  async addAdmin(): Promise<void> {
    const email = this.newEmail().trim();
    if (!email) return;
    this.isAdding.set(true);
    this.addError.set('');
    try {
      await this.adminsService.addAdmin(email);
      this.newEmail.set('');
    } catch (err: unknown) {
      this.addError.set(err instanceof Error ? err.message : 'Error al agregar admin.');
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
