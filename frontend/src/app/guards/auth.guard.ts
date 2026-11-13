import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toLogin = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  if (!auth.isLoggedIn()) {
    return toLogin();
  }
  // Token kan intussen verlopen zijn: laat de backend bevestigen.
  return auth.verify().pipe(map(valid => (valid ? true : toLogin())));
};
