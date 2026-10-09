import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { ToastComponent } from './components/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
      <nav class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50 transition-colors">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center space-x-6">
              <a routerLink="/" class="text-2xl font-black text-emerald-600 tracking-tight flex items-center gap-2">
                <span>🌿</span> BioLoggr
              </a>
              <div class="hidden sm:flex space-x-2">
                <a 
                  routerLink="/" 
                  routerLinkActive="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="text-gray-700 dark:text-gray-300 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  📖 Codex
                </a>
                <a 
                  routerLink="/map" 
                  routerLinkActive="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600"
                  class="text-gray-700 dark:text-gray-300 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  🗺️ Kaart
                </a>
                <a 
                  routerLink="/badges" 
                  routerLinkActive="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600"
                  class="text-gray-700 dark:text-gray-300 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  🏆 Badges
                </a>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <!-- Dark / Light toggle -->
              <button
                type="button"
                (click)="themeService.toggle()"
                class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                [attr.aria-label]="themeService.isDark() ? 'Schakel naar licht thema' : 'Schakel naar donker thema'"
              >
                @if (themeService.isDark()) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                }
              </button>
              <a 
                routerLink="/observe" 
                routerLinkActive="bg-emerald-700"
                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>📸</span> Nieuwe Waarneming
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main class="flex-1">
        <router-outlet></router-outlet>
      </main>

      <app-toast></app-toast>

      <footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 py-4 text-center text-xs text-gray-500 dark:text-gray-500 transition-colors">
        BioLoggr v1.0 — Natuurwaarnemingen & AI Identificatie
      </footer>
    </div>
  `
})
export class App {
  protected readonly themeService = inject(ThemeService);
}
