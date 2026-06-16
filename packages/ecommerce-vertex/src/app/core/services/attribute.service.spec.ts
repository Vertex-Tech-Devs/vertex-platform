import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { DocumentReference } from '@angular/fire/firestore';
import { AttributeService } from './attribute.service';
import { FirestoreService } from './firestore.service';
import type { Attribute } from '@core/models/attribute.model';

describe('AttributeService', () => {
  let service: AttributeService;
  let firestoreSpy: jasmine.SpyObj<FirestoreService<Attribute>>;

  const mockRef = { id: 'new-id' } as unknown as DocumentReference;

  beforeEach(() => {
    firestoreSpy = jasmine.createSpyObj('FirestoreService', [
      'getAll',
      'get',
      'create',
      'update',
      'delete',
    ]);

    TestBed.configureTestingModule({
      providers: [AttributeService, { provide: FirestoreService, useValue: firestoreSpy }],
    });

    service = TestBed.inject(AttributeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAttributes() should call firestoreService.getAll with "attributes"', () => {
    const attrs: Attribute[] = [{ id: '1', name: 'Color', values: ['Red', 'Blue'] }];
    firestoreSpy.getAll.and.returnValue(of(attrs));

    service.getAttributes().subscribe((result) => {
      expect(result).toEqual(attrs);
    });

    expect(firestoreSpy.getAll).toHaveBeenCalledWith('attributes');
  });

  it('getAttributeById() should call firestoreService.get with "attributes" and id', () => {
    const attr: Attribute = { id: '1', name: 'Talle', values: ['S', 'M', 'L'] };
    firestoreSpy.get.and.returnValue(of(attr));

    service.getAttributeById('1').subscribe((result) => {
      expect(result).toEqual(attr);
    });

    expect(firestoreSpy.get).toHaveBeenCalledWith('attributes', '1');
  });

  it('addAttribute() should call firestoreService.create with "attributes"', async () => {
    firestoreSpy.create.and.returnValue(
      Promise.resolve(mockRef) as ReturnType<typeof firestoreSpy.create>
    );
    const attr: Attribute = { name: 'Color', values: ['Red'] };

    const ref = await service.addAttribute(attr);

    expect(firestoreSpy.create).toHaveBeenCalledWith('attributes', attr);
    expect(ref).toBe(mockRef);
  });

  it('updateAttribute() should call firestoreService.update with "attributes" and id', async () => {
    firestoreSpy.update.and.returnValue(Promise.resolve());

    await service.updateAttribute('1', { name: 'Updated' });

    expect(firestoreSpy.update).toHaveBeenCalledWith('attributes', '1', { name: 'Updated' });
  });

  it('deleteAttribute() should call firestoreService.delete with "attributes" and id', async () => {
    firestoreSpy.delete.and.returnValue(Promise.resolve());

    await service.deleteAttribute('1');

    expect(firestoreSpy.delete).toHaveBeenCalledWith('attributes', '1');
  });
});
