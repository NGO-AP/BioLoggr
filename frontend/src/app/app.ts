import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <nav class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center space-x-6">
              <a routerLink="/" class="text-2xl font-black text-emerald-600 tracking-tight flex items-center gap-2">
                <span>🌿</span> BioLoggr
              </a>
              <div class="hidden sm:flex space-x-2">
                <a 
                  routerLink="/" 
                  routerLinkActive="bg-emerald-50 text-emerald-600"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Codex
                </a>
                <a 
                  routerLink="/map" 
                  routerLinkActive="bg-emerald-50 text-emerald-600"
                  class="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  🗺️ Kaart
                </a>
                <a 
                  routerLink="/badges" 
                  routerLinkActive="bg-emerald-50 text-emerald-600"
                  class="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  🏆 Badges
                </a>
              </div>
            </div>
            <div class="flex items-center space-x-3">
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

      <footer class="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
        BioLoggr v1.0 — Natuurwaarnemingen & AI Identificatie
      </footer>
    </div>
  `
})
export class App {
  protected readonly title = signal('frontend');
}
