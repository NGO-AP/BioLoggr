import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Signaleert dat ObserveComponent terug moet naar het uploadformulier (zelfde URL). */
@Injectable({ providedIn: 'root' })
export class ObserveResetService {
  private readonly reset$ = new Subject<void>();

  readonly onResetRequested$ = this.reset$.asObservable();

  requestReset(): void {
    this.reset$.next();
  }
}
