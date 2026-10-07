import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Observation {
  id: number;
  animal_id: number;
  latitude: number;
  longitude: number;
  image_path: string;
  timestamp: string;
  confidence: number;
  notes?: string;
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
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  unlocked_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000/api';

  getCodex(): Observable<Animal[]> {
    return this.http.get<Animal[]>(`${this.baseUrl}/codex`);
  }

  getAnimalDetail(id: number): Observable<Animal> {
    return this.http.get<Animal>(`${this.baseUrl}/codex/${id}`);
  }

  getObservations(): Observable<Observation[]> {
    return this.http.get<Observation[]>(`${this.baseUrl}/observations`);
  }

  createObservation(formData: FormData, lat: number, lon: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/observations?latitude=${lat}&longitude=${lon}`, formData);
  }

  getBadges(): Observable<Badge[]> {
    return this.http.get<Badge[]>(`${this.baseUrl}/badges`);
  }
}
