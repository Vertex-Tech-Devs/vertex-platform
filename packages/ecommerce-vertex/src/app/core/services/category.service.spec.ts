import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { DocumentReference } from '@angular/fire/firestore';
import { CategoryService } from './category.service';
import { FirestoreService } from './firestore.service';
import type { Category } from '@core/models/category.model';

describe('CategoryService', () => {
  let service: CategoryService;
  let firestoreSpy: jasmine.SpyObj<FirestoreService<Category>>;

  const mockRef = { id: 'new-cat' } as unknown as DocumentReference;

  beforeEach(() => {
    firestoreSpy = jasmine.createSpyObj('FirestoreService', [
      'getAll',
      'get',
      'create',
      'update',
      'delete',
    ]);

    TestBed.configureTestingModule({
      providers: [CategoryService, { provide: FirestoreService, useValue: firestoreSpy }],
    });

    service = TestBed.inject(CategoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getCategories() should call firestoreService.getAll with "categories"', () => {
    const cats: Category[] = [
      { id: '1', name: 'Remeras', slug: 'remeras', parentId: null, filterableAttributes: [] },
    ];
    firestoreSpy.getAll.and.returnValue(of(cats));

    service.getCategories().subscribe((result) => {
      expect(result).toEqual(cats);
    });

    expect(firestoreSpy.getAll).toHaveBeenCalledWith('categories');
  });

  it('addCategory() should call firestoreService.create with "categories"', async () => {
    firestoreSpy.create.and.returnValue(
      Promise.resolve(mockRef) as ReturnType<typeof firestoreSpy.create>
    );
    const cat = { name: 'Camperas', slug: 'camperas', parentId: null, filterableAttributes: [] };

    const ref = await service.addCategory(cat);

    expect(firestoreSpy.create).toHaveBeenCalledWith('categories', cat);
    expect(ref).toBe(mockRef);
  });

  it('updateCategory() should call firestoreService.update with "categories" and id', async () => {
    firestoreSpy.update.and.returnValue(Promise.resolve());

    await service.updateCategory('1', { name: 'Updated' });

    expect(firestoreSpy.update).toHaveBeenCalledWith('categories', '1', { name: 'Updated' });
  });

  it('deleteCategory() should call firestoreService.delete with "categories" and id', async () => {
    firestoreSpy.delete.and.returnValue(Promise.resolve());

    await service.deleteCategory('1');

    expect(firestoreSpy.delete).toHaveBeenCalledWith('categories', '1');
  });
});
