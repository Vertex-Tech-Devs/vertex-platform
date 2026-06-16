import { Injectable, signal, computed } from '@angular/core';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

export type AuthError = 'unauthorized' | 'popup-blocked' | 'unknown';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = getAuth();

  readonly user = signal<User | null | undefined>(undefined);
  readonly isSuperAdmin = signal<boolean>(false);
  readonly authError = signal<AuthError | null>(null);
  readonly authErrorCode = signal<string>('');
  readonly isLoggedIn = computed(() => !!this.user());
  readonly isLoading = computed(() => this.user() === undefined);

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onAuthStateChanged(this.auth, async (u) => {
      if (u) {
        const token = await getIdTokenResult(u, true);
        if (!token.claims['platformAdmin']) {
          await signOut(this.auth);
          this.authError.set('unauthorized');
          this.isSuperAdmin.set(false);
          return;
        }
        this.isSuperAdmin.set(token.claims['superAdmin'] === true);
      } else {
        this.isSuperAdmin.set(false);
      }
      this.user.set(u);
    });
  }

  async loginWithGoogle(): Promise<void> {
    this.authError.set(null);
    try {
      const result = await signInWithPopup(this.auth, new GoogleAuthProvider());
      const token = await getIdTokenResult(result.user, true);

      if (!token.claims['platformAdmin']) {
        await signOut(this.auth);
        this.authError.set('unauthorized');
        this.isSuperAdmin.set(false);
        return;
      }
      this.isSuperAdmin.set(token.claims['superAdmin'] === true);
      this.user.set(result.user);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      console.error('[Auth] loginWithGoogle failed:', code, err);
      this.authErrorCode.set(code);
      this.isSuperAdmin.set(false);
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        this.authError.set('popup-blocked');
      } else {
        this.authError.set('unknown');
      }
    }
  }

  async logout(): Promise<void> {
    this.isSuperAdmin.set(false);
    await signOut(this.auth);
  }
}
