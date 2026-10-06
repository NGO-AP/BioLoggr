import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <nav class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <span class="text-2xl font-black text-emerald-600 tracking-tight">🌿 BioLoggr</span>
            </div>
            <div class="flex items-center space-x-4">
              <a routerLink="/" class="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Codex</a>
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
