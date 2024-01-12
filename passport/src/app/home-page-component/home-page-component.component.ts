import { Component, OnInit } from '@angular/core';
import {MixpanelService} from "../services/mixpanel/mixpanel-service.service";
import {pages} from "../services/mixpanel/mixpanel.consts";

@Component({
  selector: 'app-home-page-component',
  templateUrl: './home-page-component.component.html',
  styleUrls: ['./home-page-component.component.scss']
})
export class HomePageComponentComponent implements OnInit {

  constructor(
    private mixpanelService: MixpanelService
  ) { }

  ngOnInit(): void {
    this.mixpanelService.track(pages.landingPage) //todo: whenever a router is added let's make the router automatically track page views rather than doing this at the page level
  }

}
