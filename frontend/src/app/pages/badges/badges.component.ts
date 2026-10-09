import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Badge } from '../../services/api.service';

@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">🏆 Jouw Badges & Prestaties</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">Verdien badges door dieren te ontdekken en observaties te registreren.</p>
      </div>

      @if (isLoading()) {
        <div class="flex justify-center items-center py-20">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      } @else if (errorMessage()) {
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm">
          {{ errorMessage() }}
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (badge of badges(); track badge.id) {
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 border shadow-sm transition-all flex items-start space-x-4 relative overflow-hidden"
                 [class.border-emerald-200]="badge.unlocked_at"
                 [class.dark:border-emerald-700]="badge.unlocked_at"
                 [class.border-gray-200]="!badge.unlocked_at"
                 [class.dark:border-gray-700]="!badge.unlocked_at"
                 [class.opacity-60]="!badge.unlocked_at"
            >
              <div class="text-4xl p-3 bg-gray-50 dark:bg-gray-700 rounded-xl shadow-inner flex items-center justify-center shrink-0">
                {{ badge.icon }}
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ badge.name }}</h3>
                  @if (badge.unlocked_at) {
                    <span class="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full">Behaald</span>
                  } @else {
                    <span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span>🔒</span> Vergrendeld
                    </span>
                  }
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ badge.description }}</p>
                @if (badge.unlocked_at) {
                  <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3">Ontgrendeld op: {{ badge.unlocked_at | date:'mediumDate' }}</p>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class BadgesComponent implements OnInit {
  private apiService = inject(ApiService);

  protected readonly badges = signal<Badge[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.apiService.getBadges().subscribe({
      next: (data) => {
        this.badges.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Kon badges niet laden. Controleer de backend verbinding.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }
}
