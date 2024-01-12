import { Injectable } from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import { Observable } from 'rxjs';
import {appURL, authenticatedRoutes, completePageRoutes, rootUrl} from "./app-routing.consts";
import {AuthService} from "./services/auth/auth.service";
import {GymService} from "./gym.service";
import {map} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class SetupGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private gymService: GymService
  ) {}
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if(!this.authService.isAuthenticated()) {
      return this.router.createUrlTree([rootUrl])
    }

    const isGym = this.authService.isGym();
    if(isGym) {
      return this.gymService.gymSetupComplete(route).pipe(map((data) => !data));
    }

    return this.router.createUrlTree([rootUrl]);
  }

}
