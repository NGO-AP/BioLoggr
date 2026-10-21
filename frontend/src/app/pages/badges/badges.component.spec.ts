import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BadgesComponent } from './badges.component';
import { ApiService, Badge } from '../../services/api.service';

describe('BadgesComponent', () => {
  let component: BadgesComponent;
  let fixture: ComponentFixture<BadgesComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgesComponent],
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BadgesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create and fetch badges', () => {
    const dummyBadges: Badge[] = [
      { id: 1, name: 'Eerste Waarneming', description: 'Test', icon: '🏆', unlocked_at: '2026-10-07T00:00:00Z' }
    ];

    fixture.detectChanges(); // Triggers ngOnInit

    const request = httpMock.expectOne('http://localhost:8000/api/badges');
    expect(request.request.method).toBe('GET');
    request.flush(dummyBadges);

    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect((component as any).badges().length).toBe(1);
  });
});
