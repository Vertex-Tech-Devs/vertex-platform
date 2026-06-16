import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { SeedDataGuard } from './seed-data.guard';
import { environment } from '@environments/environment';

describe('SeedDataGuard', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: routerSpy }],
    });
  });

  it('should allow activation when seedDataEnabled is true', () => {
    environment.features.seedDataEnabled = true;
    const result = TestBed.runInInjectionContext(() =>
      SeedDataGuard({} as unknown as ActivatedRouteSnapshot, {} as unknown as RouterStateSnapshot)
    );
    expect(result).toBeTrue();
  });

  it('should redirect to dashboard when seedDataEnabled is false', () => {
    environment.features.seedDataEnabled = false;
    const mockTree = {} as unknown as UrlTree;
    routerSpy.createUrlTree.and.returnValue(mockTree);

    const result = TestBed.runInInjectionContext(() =>
      SeedDataGuard({} as unknown as ActivatedRouteSnapshot, {} as unknown as RouterStateSnapshot)
    );
    expect(result).toBe(mockTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
  });
});
