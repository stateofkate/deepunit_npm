import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import {AuthService} from "../auth/auth.service";
import {appURL, authenticatedRoutes, completePageRoutes, rootUrl} from "../../app-routing.consts";
import {GymService} from "../../gym.service";
import {map, take, tap} from "rxjs/operators";
import {RequestService} from "../request-service/request.service";

@Injectable({
  providedIn: 'root'
})
export class GymAuthGuardGuard implements CanActivateChild, CanActivate {
  public constructor(
    private authService: AuthService,
    private router: Router,
    private gymService: GymService,
    private requestService: RequestService
  ) {}

  public canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate(childRoute, state);
  }

  public canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if(!this.authService.isAuthenticated()) {
      return this.router.createUrlTree([rootUrl])
    }
    const isGym = this.authService.isGym();
    if(isGym) {
      return this.requestService.getGym().pipe(
        map((data: any) =>{
          if(data.error) {
            return this.router.createUrlTree([rootUrl]) //If we had an error I guess we can just boot them to the marketing site???
          }
          const isComplete = data.setupComplete;
          return isComplete ? true : this.router.createUrlTree([authenticatedRoutes.setup]);
        }));

    }
    if(isGym || this.authService.isOps()) {
      return true;
    }
    if(this.authService.isMember()) {
      return this.router.createUrlTree([completePageRoutes.memberBase]);
    }
    return this.router.createUrlTree([rootUrl])
  }


}
