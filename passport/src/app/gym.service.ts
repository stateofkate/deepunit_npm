import { Injectable } from '@angular/core';
import {RequestService} from "./services/request-service/request.service";
import {map, take} from "rxjs/operators";
import {ActivatedRouteSnapshot, Router} from "@angular/router";
import {authenticatedRoutes, rootUrl} from "./app-routing.consts";
import {Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class GymService {

  constructor(
    private requestService: RequestService,
    private router: Router,
  ) { }

  //Only for guards
  public gymSetupComplete(route: ActivatedRouteSnapshot) {
    console.log('setup incomplete')
    return this.requestService.getGym().pipe((take(1)),
      map((data: any) =>{
        console.log('guard data')
        console.log(data)
        if(data.error) {
          console.error(data.error)
          return this.router.navigate([rootUrl]) //If we had an error I guess we can just boot them to the marketing site???
        }
        const isComplete = data.setupComplete;
        if(!isComplete && data.gyms.length > 0 && !route.params.id) {
          console.log('this is where we would do things')
          let gymToSetupId: string | undefined = undefined;
          data.gyms.forEach((gym: any) => {
            console.log('foreach')
            if(gym && gym.setupStep !== 'step4' && gym.id) {
              gymToSetupId = gym.id;
              return;
            }
          })
          console.log('heyyayayayayyaya')
          if(gymToSetupId) {
            console.log('infinete looops')
            console.log('infinete looops')
            console.log('infinete looops')
            console.log('infinete looops')
            return this.router.navigate([authenticatedRoutes.setup + '/' + gymToSetupId])
          }
        }
        console.log('returning complete ' + isComplete)
        return isComplete
      })
      )
  }
}
