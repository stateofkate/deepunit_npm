import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {AuthService} from "../services/auth/auth.service";

@Component({
  selector: 'app-app-nav-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit {

  @Output() public hamburgerToggle = new EventEmitter();
  constructor(private authService: AuthService) { }

  ngOnInit(): void {
  }
  public logout() {
    this.authService.logout();
  }

      public toggleBurger() {
        this.hamburgerToggle.emit();
      }
}
