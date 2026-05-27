import { Injectable, signal, computed } from '@angular/core';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
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
    getRedirectResult(this.auth).catch((err) => {
      const code = (err as { code?: string })?.code ?? '';
      console.error('[Auth] getRedirectResult failed:', code, err);
      this.authErrorCode.set(code);
      this.authError.set('unknown');
    });

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
      await signInWithRedirect(this.auth, new GoogleAuthProvider());
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      console.error('[Auth] loginWithGoogle failed:', code, err);
      this.authErrorCode.set(code);
      this.isSuperAdmin.set(false);
      this.authError.set('unknown');
    }
  }

  async logout(): Promise<void> {
    this.isSuperAdmin.set(false);
    await signOut(this.auth);
  }
}
