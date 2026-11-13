import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

const TOKEN_KEY = 'biologgr_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000/api';

  private readonly tokenSignal = signal<string | null>(sessionStorage.getItem(TOKEN_KEY));
  readonly token = this.tokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenSignal() !== null);

  constructor() {
    // Een opgeslagen token kan verlopen zijn: controleer stilletjes bij het opstarten.
    if (this.tokenSignal() !== null) {
      this.verify().subscribe();
    }
  }

  login(password: string): Observable<void> {
    return this.http
      .post<{ token: string }>(`${this.baseUrl}/auth/login`, { password })
      .pipe(
        tap(res => {
          sessionStorage.setItem(TOKEN_KEY, res.token);
          this.tokenSignal.set(res.token);
        }),
        map(() => undefined),
      );
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
  }

  /** Controleert het token bij de backend; bij 401 wordt de gebruiker uitgelogd. */
  verify(): Observable<boolean> {
    return this.http.get<{ valid: boolean }>(`${this.baseUrl}/auth/verify`).pipe(
      map(res => res.valid),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.logout();
          return of(false);
        }
        // Netwerk-/serverfout: token niet weggooien, de backend blijft de echte controle.
        return of(true);
      }),
    );
  }
}
