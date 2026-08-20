import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { StoresService } from '@core/services/stores';
import { errorMessage } from '@core/utils/error.util';
import type { StaffMember, PendingInvitation } from '@core/models/store';

@Injectable({ providedIn: 'root' })
export class StoreDetailStaffService {
  private storesService = inject(StoresService);
  private fb = inject(FormBuilder);

  readonly staff = signal<StaffMember[]>([]);
  readonly invitations = signal<PendingInvitation[]>([]);
  readonly isLoadingStaff = signal(false);
  readonly isInvitingStaff = signal(false);
  readonly isGeneratingLink = signal(false);
  readonly inviteError = signal('');
  readonly inviteSuccess = signal('');
  readonly generatedResetLink = signal('');
  readonly copyFeedbackSuccess = signal(false);

  readonly inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['admin', Validators.required],
  });

  async loadStaff(storeId: string): Promise<void> {
    this.isLoadingStaff.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    try {
      const res = await this.storesService.getStoreStaff(storeId);
      this.staff.set(res.staff);
      this.invitations.set(res.invitations);
    } catch (err) {
      console.error('Error loading staff:', err);
      this.inviteError.set('No se pudieron cargar los miembros del equipo.');
    } finally {
      this.isLoadingStaff.set(false);
    }
  }

  async sendInvitation(storeId: string, email: string, role: string): Promise<boolean> {
    this.isInvitingStaff.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    try {
      const result = await this.storesService.inviteStaff(storeId, email, role);
      if (result.inviteEmailSent) {
        this.inviteSuccess.set(
          `Invitación enviada con éxito a ${email}. El acceso queda habilitado con Google OAuth y el rol seleccionado.`,
        );
      } else {
        this.inviteSuccess.set(
          `El correo ${email} quedó preautorizado con rol ${role}, pero el email automático falló. Compartí manualmente el acceso por Google OAuth.`,
        );
      }
      await this.loadStaff(storeId);
      return true;
    } catch (err) {
      console.error('Error inviting staff:', err);
      this.inviteError.set(errorMessage(err) || 'No se pudo enviar la invitación. Intentá de nuevo.');
      return false;
    } finally {
      this.isInvitingStaff.set(false);
    }
  }

  async sendInvitationFromForm(storeId: string): Promise<boolean> {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return false;
    }
    const { email, role } = this.inviteForm.value;
    const ok = await this.sendInvitation(storeId, email!, role!);
    if (ok) {
      this.inviteForm.reset({ email: '', role: 'admin' });
    }
    return ok;
  }

  async generateAccessLink(storeId: string, email: string): Promise<void> {
    this.isGeneratingLink.set(true);
    this.generatedResetLink.set('');
    this.copyFeedbackSuccess.set(false);
    this.inviteError.set('');
    try {
      const res = await this.storesService.generatePasswordResetLink(storeId, email);
      if (res.success && res.actionLink) {
        this.generatedResetLink.set(res.actionLink);
      } else {
        this.inviteError.set('No se pudo obtener el enlace de acceso manual.');
      }
    } catch (err) {
      this.inviteError.set(errorMessage(err, 'Error al generar link de acceso.'));
    } finally {
      this.isGeneratingLink.set(false);
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copyFeedbackSuccess.set(true);
      setTimeout(() => this.copyFeedbackSuccess.set(false), 3000);
    } catch {
      console.error('Failed to copy to clipboard automatically.');
    }
  }
}
