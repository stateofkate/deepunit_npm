import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomePageComponentComponent } from './home-page-component/home-page-component.component';
import { HeaderComponentComponent } from './header-component/header-component.component';
import { FooterComponentComponent } from './footer-component/footer-component.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { OpLoginPageComponent } from './pages/login-page/op-login-page.component';
import { MarketingSiteHomePageComponent } from './pages/marketing-site-home/marketing-site-home-page.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import { AppRootComponent } from './pages/app-auth/app-root/app-root.component';
import {CommonModule} from "@angular/common";
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {AuthInterceptorInterceptor} from "./auth-interceptor/auth-interceptor.interceptor";
import { LeftNavComponent } from './left-nav/left-nav.component';
import { PhoneMaskDirective } from './phone-mask.directive';
import { PhoneInputComponent } from './components/phone-input/phone-input.component';
import { MenuBarComponent } from './app-nav-bar/menu-bar.component';
import { CreateGymInviteConfirmationComponent } from './create-gym-confirmation/create-gym-invite-confirmation.component';
import { ListGymInvitesComponent } from './list-gyms/list-gym-invites.component';
import { GymSignupComponent } from './gym-signup/gym-signup.component';
import { OpsRootComponent } from './ops-root/ops-root.component';
import { GymRootComponent } from './gym-root/gym-root.component';
import { ListCheckinsComponent } from './list-checkins/list-checkins.component';
import { GymSetupComponent } from './gym-setup/gym-setup.component';
import { NgxSpinnerModule } from "ngx-spinner";

@NgModule({
  declarations: [
    AppComponent,
    HomePageComponentComponent,
    HeaderComponentComponent,
    FooterComponentComponent,
    OpLoginPageComponent,
    MarketingSiteHomePageComponent,
    AppRootComponent,
    LeftNavComponent,
    PhoneInputComponent,
    MenuBarComponent,
    CreateGymInviteConfirmationComponent,
    ListGymInvitesComponent,
    GymSignupComponent,
    OpsRootComponent,
    GymRootComponent,
    ListCheckinsComponent,
    GymSetupComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    NgxSpinnerModule,
  ],
  providers: [{provide: HTTP_INTERCEPTORS, useClass: AuthInterceptorInterceptor, multi: true}],
  bootstrap: [AppComponent],
  exports: []
})
export class AppModule { }
