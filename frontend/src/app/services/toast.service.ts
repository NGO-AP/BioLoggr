import { Injectable, signal } from '@angular/core';
import { BadgeSummary } from './api.service';

export interface ToastItem {
  id: number;
  badge: BadgeSummary;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<ToastItem[]>([]);

  showBadgeToast(badge: BadgeSummary): void {
    const item: ToastItem = { id: this.nextId++, badge };
    this.toasts.update(list => [...list, item]);
    setTimeout(() => this.dismiss(item.id), 5000);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
