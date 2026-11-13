import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="max-w-md mx-auto px-4 py-12 sm:py-20">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8 transition-colors">
        <div class="text-center mb-6">
          <div class="text-4xl mb-2">🔐</div>
          <h1 class="text-2xl font-black text-gray-900 dark:text-gray-100">Inloggen</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Log in om waarnemingen toe te voegen of te verwijderen.
          </p>
        </div>

        <form (submit)="submit($event)" class="space-y-4">
          <div class="space-y-1.5">
            <label for="password" class="block text-sm font-semibold text-gray-700 dark:text-gray-300">Wachtwoord</label>
            <input
              id="password"
              type="password"
              autocomplete="current-password"
              required
              autofocus
              [value]="password()"
              (input)="onPasswordInput($event)"
              class="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </div>

          @if (error()) {
            <div
              role="alert"
              class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm"
            >{{ error() }}</div>
          }

          <button
            type="submit"
            [disabled]="loading() || !password()"
            class="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl shadow transition-colors cursor-pointer"
          >
            {{ loading() ? 'Bezig…' : 'Inloggen' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly password = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.loading() || !this.password()) return;

    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.password()).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.password.set('');
        this.error.set(
          err.status === 401
            ? 'Onjuist wachtwoord. Probeer het opnieuw.'
            : err.status === 429
              ? 'Te veel mislukte pogingen. Probeer het over enkele minuten opnieuw.'
              : err.status === 503
              ? 'De server is niet geconfigureerd voor inloggen.'
              : 'Inloggen mislukt. Is de server bereikbaar?',
        );
      },
    });
  }

  /** Alleen interne paden toestaan (geen open redirect). */
  private safeReturnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
