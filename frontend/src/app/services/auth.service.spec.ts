import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

describe('AuthService + authInterceptor', () => {
  let service: AuthService;
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.removeItem('biologgr_token');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.removeItem('biologgr_token');
  });

  it('starts logged out', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('login stores the token in a signal and sessionStorage', () => {
    service.login('geheim').subscribe();
    const req = httpMock.expectOne(`${API}/auth/login`);
    expect(req.request.body).toEqual({ password: 'geheim' });
    req.flush({ token: 'abc' });

    expect(service.isLoggedIn()).toBeTrue();
    expect(sessionStorage.getItem('biologgr_token')).toBe('abc');
  });

  it('logout clears the token', () => {
    service.login('geheim').subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush({ token: 'abc' });

    service.logout();

    expect(service.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem('biologgr_token')).toBeNull();
  });

  it('interceptor adds the Bearer header to API calls when logged in', () => {
    service.login('geheim').subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush({ token: 'abc' });

    http.get(`${API}/codex`).subscribe();
    const req = httpMock.expectOne(`${API}/codex`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush([]);
  });

  it('interceptor does not send the token to other hosts', () => {
    service.login('geheim').subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush({ token: 'abc' });

    http.get('https://example.com/api/x').subscribe();
    const req = httpMock.expectOne('https://example.com/api/x');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('interceptor logs out and redirects to /login on 401', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    service.login('geheim').subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush({ token: 'abc' });

    http.delete(`${API}/observations/1`).subscribe({ error: () => undefined });
    httpMock.expectOne(`${API}/observations/1`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(service.isLoggedIn()).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('a wrong password (401 on login) does not redirect', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    service.login('fout').subscribe({ error: () => undefined });
    httpMock.expectOne(`${API}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('verify logs out on 401', () => {
    service.login('geheim').subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush({ token: 'abc' });

    let result: boolean | undefined;
    service.verify().subscribe(v => (result = v));
    httpMock.expectOne(`${API}/auth/verify`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBeFalse();
    expect(service.isLoggedIn()).toBeFalse();
  });
});
