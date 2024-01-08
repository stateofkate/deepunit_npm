import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {AuthService} from "../services/auth/auth.service";
import {take} from "rxjs/operators";
import {RequestService} from "../services/request-service/request.service";
import { completePageRoutes } from "../app-routing.consts";

@Component({
  selector: 'app-left-nav',
  templateUrl: './left-nav.component.html',
  styleUrls: ['./left-nav.component.scss']
})
export class LeftNavComponent implements OnInit {
  @Output() public hamburgerToggle = new EventEmitter();

  readonly routes = completePageRoutes;
  constructor(
    private httpClient: HttpClient,
    private authService: AuthService,
    private requestService: RequestService) { }

  ngOnInit(): void {
  }

    public toggleHamburger() {
      this.hamburgerToggle.emit();
    }

    public logout() {
      this.authService.logout();
    }

    public impersonate() {
      const data = {
        id: 'test'
      }
      console.log('sending it')
      this.requestService.generateTest(data).subscribe((response) => {
        console.log(response)
      })
    }
}
