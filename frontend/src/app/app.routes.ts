import { Routes } from '@angular/router';
import { CodexComponent } from './pages/codex/codex.component';
import { ObserveComponent } from './pages/observe/observe.component';
import { BadgesComponent } from './pages/badges/badges.component';
import { MapComponent } from './pages/map/map.component';

export const routes: Routes = [
  { path: '', component: CodexComponent },
  { path: 'observe', component: ObserveComponent },
  { path: 'badges', component: BadgesComponent },
  { path: 'map', component: MapComponent },
  { path: '**', redirectTo: '' }
];
