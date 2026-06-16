import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { OwnerGuard } from './owner.guard';
import { of } from 'rxjs';
import type { Observable } from 'rxjs';

describe('OwnerGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      isOwner$: of(false),
    });
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue({} as UrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('should allow access (return true) if user is owner', (done) => {
    Object.defineProperty(authServiceSpy, 'isOwner$', { get: () => of(true) });

    TestBed.runInInjectionContext(() => {
      const result = OwnerGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      ) as Observable<UrlTree | boolean>;
      if (typeof result === 'boolean') {
        expect(result).toBe(true);
        done();
      } else {
        result.subscribe((val) => {
          expect(val).toBe(true);
          done();
        });
      }
    });
  });

  it('should redirect to /admin/dashboard if user is not owner', (done) => {
    const dummyUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(dummyUrlTree);

    TestBed.runInInjectionContext(() => {
      const result = OwnerGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      ) as Observable<UrlTree | boolean>;
      if (typeof result === 'boolean') {
        fail('Expected observable result');
        done();
      } else {
        result.subscribe((val) => {
          expect(val).toBe(dummyUrlTree);
          expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
          done();
        });
      }
    });
  });
});
