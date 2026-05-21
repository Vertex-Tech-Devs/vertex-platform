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

export type AuthError = 'unauthorized' | 'unknown';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = getAuth();

  readonly user = signal<User | null | undefined>(undefined);
  readonly authError = signal<AuthError | null>(null);
  readonly isLoggedIn = computed(() => !!this.user());
  readonly isLoading = computed(() => this.user() === undefined);

  constructor() {
    onAuthStateChanged(this.auth, async (u) => {
      if (u) {
        const token = await getIdTokenResult(u, true);
        if (!token.claims['platformAdmin']) {
          await signOut(this.auth);
          this.authError.set('unauthorized');
          return;
        }
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
        return;
      }
    } catch {
      this.authError.set('unknown');
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
