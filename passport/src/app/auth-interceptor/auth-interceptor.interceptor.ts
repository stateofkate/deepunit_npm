import {Injectable, isDevMode} from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import {AuthService} from "../services/auth/auth.service";

@Injectable()
export class AuthInterceptorInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
      if(this.authService.isAuthenticated()) {

        //note: non-dev mode is not tested. If having auth issues in non-local deployments perhaps this logic isn't quite right...
        if(request.url.startsWith(isDevMode() ? 'http://localhost' : 'https://thefitpassport.com')) {
          console.log(this.authService.getAuthToken())
          const newRequest = request.clone({ setHeaders: { Authorization: this.authService.getAuthToken() } })
          console.log(newRequest)
          return next.handle(newRequest)
        } else {
          console.log('why are we making a request anywhere else? ' + request.url)
        }
      }
      return next.handle(request);
    }
}
