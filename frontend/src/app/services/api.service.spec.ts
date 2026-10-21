import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService, Animal, Observation, Badge } from './api.service';

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

  it('should fetch observations via GET /api/observations', () => {
    const dummyObs: Observation[] = [
      { id: 1, animal_id: 1, latitude: 52.0, longitude: 5.0, image_path: '/uploads/test.jpg', timestamp: '2026-10-07T00:00:00Z', confidence: 0.95 }
    ];

    service.getObservations().subscribe(obs => {
      expect(obs.length).toBe(1);
      expect(obs).toEqual(dummyObs);
    });

    const request = httpMock.expectOne('http://localhost:8000/api/observations');
    expect(request.request.method).toBe('GET');
    request.flush(dummyObs);
  });

  it('should fetch badges via GET /api/badges', () => {
    const dummyBadges: Badge[] = [
      { id: 1, name: 'Eerste Waarneming', description: 'Test', icon: '🏆', unlocked_at: '2026-10-07T00:00:00Z' }
    ];

    service.getBadges().subscribe(badges => {
      expect(badges.length).toBe(1);
      expect(badges).toEqual(dummyBadges);
    });

    const request = httpMock.expectOne('http://localhost:8000/api/badges');
    expect(request.request.method).toBe('GET');
    request.flush(dummyBadges);
  });
});
