import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService, Animal } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch codex animals via GET /api/codex', () => {
    const dummyAnimals: Animal[] = [
      { id: 1, scientific_name: 'Vulpes vulpes', dutch_name: 'Rode Vos', rarity: 'Common', description: 'Fox description' }
    ];

    service.getCodex().subscribe(animals => {
      expect(animals.length).toBe(1);
      expect(animals).toEqual(dummyAnimals);
    });

    const request = httpMock.expectOne('http://localhost:8000/api/codex');
    expect(request.request.method).toBe('GET');
    request.flush(dummyAnimals);
  });
});
