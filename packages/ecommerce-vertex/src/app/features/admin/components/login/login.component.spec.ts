import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import type { UserCredential } from '@angular/fire/auth';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '@core/services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'loginWithGoogle',
      'logout',
      'isAuthenticated',
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    authServiceSpy.isAuthenticated.and.returnValue(of(false));
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loginWithGoogle when Google login is requested', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(of({} as UserCredential));

    component.onGoogleLogin();

    expect(authServiceSpy.loginWithGoogle).toHaveBeenCalled();
  });

  it('should navigate to /admin after successful Google login', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(of({} as UserCredential));

    component.onGoogleLogin();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('should set authErrorMessage when Google login fails', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(
      throwError(() => new Error('auth/unauthorized-domain'))
    );

    component.onGoogleLogin();

    expect(component.authErrorMessage).toBeTruthy();
    expect(component.isGoogleSubmitting).toBeFalse();
  });

  it('should detect authError query param and set error message', () => {
    // Re-create component with authError param
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({ authError: '1' }) },
        },
      ],
    });

    const f2 = TestBed.createComponent(LoginComponent);
    f2.detectChanges();

    expect(f2.componentInstance.authErrorMessage).toBeTruthy();
  });

  it('should set isAlreadyLogged to true when user is already authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(of(true));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    });

    const f3 = TestBed.createComponent(LoginComponent);
    f3.detectChanges();

    expect(f3.componentInstance.isAlreadyLogged).toBeTrue();
  });

  it('should set permission-denied error message on unauthorized error', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(
      throwError(() => new Error('permission-denied'))
    );

    component.onGoogleLogin();

    expect(component.authErrorMessage).toContain('no está autorizada');
    expect(component.isGoogleSubmitting).toBeFalse();
  });

  it('should set popup-blocked error message when popup is blocked', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(
      throwError(() => new Error('auth/popup-blocked'))
    );

    component.onGoogleLogin();

    expect(component.authErrorMessage).toContain('bloqueó');
    expect(component.isGoogleSubmitting).toBeFalse();
  });

  it('should set generic error message for unknown errors', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(
      throwError(() => new Error('some-unknown-error'))
    );

    component.onGoogleLogin();

    expect(component.authErrorMessage).toBe(
      'No se pudo iniciar sesión con Google. Intentá de nuevo.'
    );
    expect(component.isGoogleSubmitting).toBeFalse();
  });

  it('should handle raw string error on login with Google', () => {
    authServiceSpy.loginWithGoogle.and.returnValue(throwError(() => 'auth/popup-blocked'));

    component.onGoogleLogin();

    expect(component.authErrorMessage).toContain('bloqueó');
    expect(component.isGoogleSubmitting).toBeFalse();
  });

  it('logout() should set isAlreadyLogged to false', async () => {
    authServiceSpy.logout = jasmine.createSpy('logout').and.returnValue(Promise.resolve());
    component.isAlreadyLogged = true;

    await component.logout();

    expect(component.isAlreadyLogged).toBeFalse();
  });
});
