import { Routes } from '@angular/router';
import { CodexComponent } from './pages/codex/codex.component';
import { ObserveComponent } from './pages/observe/observe.component';
import { BadgesComponent } from './pages/badges/badges.component';
import { MapComponent } from './pages/map/map.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: CodexComponent },
  { path: 'observe', component: ObserveComponent, canActivate: [authGuard] },
  { path: 'badges', component: BadgesComponent },
  { path: 'map', component: MapComponent },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: '' }
];
