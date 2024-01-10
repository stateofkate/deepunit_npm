import { Injectable } from '@angular/core';
import {
  Router, Resolve,
  RouterStateSnapshot,
  ActivatedRouteSnapshot
} from '@angular/router';
import { Observable, of } from 'rxjs';
import {map, take} from "rxjs/operators";
import {RequestService} from "./services/request-service/request.service";

@Injectable({
  providedIn: 'root'
})
export class SetupResolver implements Resolve<boolean> {
  constructor(private requestService: RequestService){}

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<any> {
    console.log('resolver')
    console.log(route)
    return this.requestService.getGym().pipe(take(1), map((data) => {
      console.log(route)
      console.log(data)
      if(route.data?.setup?.id) {
        console.log(data)

        return data
      }
      return data;
    }))
  }
}
