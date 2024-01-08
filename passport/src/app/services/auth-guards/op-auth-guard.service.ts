import {Injectable} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree
} from "@angular/router";
import {AuthService} from "../auth/auth.service";
import {accountType} from "../request-service/request-service.consts";
import {Observable} from "rxjs";
import {appURL, authenticatedRoutes, unauthenticatedRoutes} from "../../app-routing.consts";

@Injectable({
  providedIn: 'root'
})
export class OpAuthGuardService implements CanActivateChild {

  constructor(private authService: AuthService,
              private router: Router) { }

  public canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot):  boolean | UrlTree {
    console.log(state)
    console.log(route)
    console.log('is authy: ' + this.authService.isAuthenticated())
    if(!this.authService.isAuthenticated()) {
      return this.router.createUrlTree([unauthenticatedRoutes.oplogin]);
    }
    const userAccountType = this.authService.getUserType();
    if(userAccountType !== accountType.ops) {
      if(userAccountType === accountType.member) {
        return this.router.createUrlTree([authenticatedRoutes.members]);
      }
      if(userAccountType === accountType.gym) {
        return this.router.createUrlTree([authenticatedRoutes.gym]);
      }
      return this.router.createUrlTree([appURL])
    }
    return true;
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    return this.canActivate(childRoute, state);
  }
}
