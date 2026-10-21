import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';

export interface Observation {
  id: number;
  animal_id: number;
  latitude: number | null;
  longitude: number | null;
  image_path: string;
  thumbnail_path?: string | null;
  timestamp: string;
  confidence: number;
  notes?: string;
  is_wild: boolean;
  iso?: number | null;
  aperture?: number | null;
  focal_length?: number | null;
  shutter_speed?: string | null;
  camera_model?: string | null;
}

export interface Animal {
  id: number;
  scientific_name: string;
  dutch_name: string;
  category: string;
  rarity: string;
  description: string;
  image_url?: string;
  extra_info?: Record<string, any>;
  latest_observation?: Observation | null;
  all_observations?: Observation[];
}

export interface Suggestion {
  animal_id: number;
  dutch_name: string;
  scientific_name: string;
  confidence: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  is_challenge: boolean;
  unlocked: boolean;
  current: number;
  target: number;
  percentage: number;
  unlocked_at: string | null;
}

export interface BadgeSummary {
  id: string;
  title: string;
  description: string;
  icon: string;
  is_challenge: boolean;
}

export interface Stats {
  total_observed: number;
  total_codex: number;
  total_observations: number;
  wild_observations: number;
  zoo_observations: number;
  by_category: Record<string, number>;
  badges_unlocked: number;
  badges_total: number;
  challenges_unlocked: number;
  challenges_total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000/api';
  private codexCache$: Observable<Animal[]> | null = null;

  getCodex(options?: { refresh?: boolean }): Observable<Animal[]> {
    if (options?.refresh) {
      this.invalidateCodexCache();
    }
    if (!this.codexCache$) {
      this.codexCache$ = this.http.get<Animal[]>(`${this.baseUrl}/codex`).pipe(
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.codexCache$;
  }

  invalidateCodexCache(): void {
    this.codexCache$ = null;
  }

  getAnimalDetail(id: number): Observable<Animal> {
    return this.http.get<Animal>(`${this.baseUrl}/codex/${id}`);
  }

  getObservations(): Observable<Observation[]> {
    return this.http.get<Observation[]>(`${this.baseUrl}/observations`);
  }

  identifyImage(file: File): Observable<{ status: string; suggestions: Suggestion[]; message?: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/identify`, fd);
  }

  createObservation(
    formData: FormData,
    lat: number | null,
    lon: number | null,
    isWild: boolean = true,
    animalId: number | null = null,
    matchScore: number | null = null,
  ): Observable<any> {
    const params: string[] = [`is_wild=${isWild}`];
    if (lat !== null && lon !== null) {
      params.push(`latitude=${lat}`, `longitude=${lon}`);
    }
    if (animalId !== null) params.push(`animal_id=${animalId}`);
    if (matchScore !== null) params.push(`match_score=${matchScore}`);
    return this.http.post<any>(`${this.baseUrl}/observations?${params.join('&')}`, formData).pipe(
      tap(() => this.invalidateCodexCache()),
    );
  }

  deleteObservation(id: number): Observable<{ ok: boolean; deleted_id: number }> {
    return this.http
      .delete<{ ok: boolean; deleted_id: number }>(`${this.baseUrl}/observations/${id}`)
      .pipe(tap(() => this.invalidateCodexCache()));
  }

  getBadges(): Observable<Badge[]> {
    return this.http.get<Badge[]>(`${this.baseUrl}/badges`);
  }

  getStats(): Observable<Stats> {
    return this.http.get<Stats>(`${this.baseUrl}/stats`);
  }
}
