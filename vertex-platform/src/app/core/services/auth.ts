import { Injectable, signal, computed, inject, InjectionToken } from '@angular/core';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';

export type AuthError = 'unauthorized' | 'popup-blocked' | 'unknown';

export interface AuthFirebaseDeps {
  getAuth: typeof getAuth;
  onAuthStateChanged: typeof onAuthStateChanged;
  signInWithPopup: typeof signInWithPopup;
  signOut: typeof signOut;
  getIdTokenResult: typeof getIdTokenResult;
  getFunctions: typeof getFunctions;
  httpsCallable: typeof httpsCallable;
}

export const AUTH_FIREBASE_DEPS = new InjectionToken<AuthFirebaseDeps>('AUTH_FIREBASE_DEPS', {
  providedIn: 'root',
  factory: () => ({
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    getIdTokenResult,
    getFunctions,
    httpsCallable,
  }),
});

@Injectable({ providedIn: 'root' })
export class AuthService {
  private firebase = inject(AUTH_FIREBASE_DEPS);

  private get auth() {
    return this.firebase.getAuth();
  }

  private get fns() {
    return this.firebase.getFunctions();
  }

  readonly user = signal<User | null | undefined>(undefined);
  readonly isSuperAdmin = signal<boolean>(false);
  readonly authError = signal<AuthError | null>(null);
  readonly authErrorCode = signal<string>('');
  readonly isLoggedIn = computed(() => !!this.user());
  readonly isLoading = computed(() => this.user() === undefined);

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.firebase.onAuthStateChanged(this.auth, async (u) => {
      if (u) {
        let token = await this.firebase.getIdTokenResult(u, true);
        if (!token.claims['platformAdmin']) {
          try {
            const refreshClaim = this.firebase.httpsCallable(this.fns, 'refreshMyPlatformAdminClaim');
            await refreshClaim();
            token = await this.firebase.getIdTokenResult(u, true);
          } catch (e) {
            console.error('[Auth] Failed to refresh platformAdmin claim', e);
          }

          if (!token.claims['platformAdmin']) {
            await this.firebase.signOut(this.auth);
            this.authError.set('unauthorized');
            this.isSuperAdmin.set(false);
            return;
          }
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
      const result = await this.firebase.signInWithPopup(this.auth, new GoogleAuthProvider());
      let token = await this.firebase.getIdTokenResult(result.user, true);

      if (!token.claims['platformAdmin']) {
        try {
          const refreshClaim = this.firebase.httpsCallable(this.fns, 'refreshMyPlatformAdminClaim');
          await refreshClaim();
          token = await this.firebase.getIdTokenResult(result.user, true);
        } catch (e) {
          console.error('[Auth] Failed to refresh platformAdmin claim after login', e);
        }

        if (!token.claims['platformAdmin']) {
          await this.firebase.signOut(this.auth);
          this.authError.set('unauthorized');
          this.isSuperAdmin.set(false);
          return;
        }
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
    await this.firebase.signOut(this.auth);
  }
}
