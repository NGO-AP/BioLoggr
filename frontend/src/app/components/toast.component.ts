import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border animate-slide-in"
          [class]="toast.badge.is_challenge
            ? 'bg-amber-50 dark:bg-amber-900/90 border-amber-400 dark:border-amber-500 shadow-amber-200 dark:shadow-amber-900'
            : 'bg-white dark:bg-gray-800 border-emerald-300 dark:border-emerald-600'"
        >
          <!-- Icon -->
          <div
            class="text-3xl shrink-0 p-2 rounded-xl"
            [class]="toast.badge.is_challenge
              ? 'bg-amber-100 dark:bg-amber-800'
              : 'bg-emerald-50 dark:bg-gray-700'"
          >
            {{ toast.badge.icon }}
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            @if (toast.badge.is_challenge) {
              <span class="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-800/50 px-2 py-0.5 rounded-full mb-1">
                🔥 Uitdaging Voltooid!
              </span>
            } @else {
              <span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                🎉 Badge Vrijgespeeld
              </span>
            }
            <p class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ toast.badge.title }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{{ toast.badge.description }}</p>
          </div>

          <!-- Dismiss -->
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none cursor-pointer"
            aria-label="Sluit melding"
          >×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }
    .animate-slide-in { animation: slide-in 0.3s ease-out; }
  `],
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
}
