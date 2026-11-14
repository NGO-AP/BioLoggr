import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/** Login en verify regelen hun eigen 401-afhandeling (foutmelding resp. stil uitloggen). */
const SELF_HANDLED_URLS = [`${environment.apiUrl}/auth/login`, `${environment.apiUrl}/auth/verify`];

/** Eigen backend: alles onder `environment.apiUrl` (token nooit naar derden). */
const OWN_API_PREFIX = `${environment.apiUrl}/`;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiCall = req.url.startsWith(OWN_API_PREFIX);
  const token = auth.token();
  const outgoing =
    isApiCall && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        isApiCall &&
        !SELF_HANDLED_URLS.some(url => req.url.includes(url))
      ) {
        auth.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
