import { Injectable } from '@angular/core';
import * as mixpanel from 'mixpanel-browser';

@Injectable({
  providedIn: 'root'
})
//https://medium.com/@jeffreyyy/mixpanel-for-angular-e0c0d8c08d3a
//https://mixpanel.com/report/2762275/view/3297659/setup/
//https://developer.mixpanel.com/docs/javascript-quickstart
export class MixpanelService {

  /**
   * Initialize mixpanel.
   *
   * @param {string} userToken
   * @memberof MixpanelService
   */
  init(): void {
    const prodHost: string = "thefitpassport.com";

    const hostName = window.location.host;
    //We should always send mixpanel data to the dev project if on localhost or not on TheFitPassport.com
    if(hostName.includes('localhost') || !hostName.includes(prodHost)) {
      mixpanel.init('76927b710092b6c41a4def398e1e02b3') // dev project token
    } else {
      mixpanel.init('d3ed39867e332f84c676496de32319d6'); //prod TheFitPassport.com project token
    }
    //mixpanel.identify(userToken);
  }

  /**
   * Push new action to mixpanel.
   *
   * @param {string} id Name of the action to track.
   * @param {*} [action={}] Actions object with custom properties.
   * @memberof MixpanelService
   */
  track(id: string, action: any = {}): void {
    mixpanel.track(id, action);
  }


}
