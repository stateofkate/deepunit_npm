import {Component, OnInit} from '@angular/core';
import {MixpanelService} from "./services/mixpanel/mixpanel-service.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Fit Passport';

  constructor(
    private mixpanelService: MixpanelService
  ) {
  }
  public ngOnInit(): void {
    this.mixpanelService.init();
  }
}
