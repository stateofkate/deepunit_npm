import { Component, OnInit } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {AuthService} from "../../../services/auth/auth.service";

@Component({
  selector: 'app-app-root',
  templateUrl: './app-root.component.html',
  styleUrls: ['./app-root.component.scss']
})
export class AppRootComponent implements OnInit {
  public leftNavExpanded: boolean = true;

  constructor(private httpClient: HttpClient, private authService: AuthService) { }

  public ngOnInit(): void {
  }

  public toggleLeftNav() {
    this.leftNavExpanded = !this.leftNavExpanded;
  }
}
