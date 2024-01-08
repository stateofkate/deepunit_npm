import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {OpLoginPageComponent} from "./pages/login-page/op-login-page.component";
import {MarketingSiteHomePageComponent} from "./pages/marketing-site-home/marketing-site-home-page.component";
import {AppRootComponent} from "./pages/app-auth/app-root/app-root.component";
import {OpAuthGuardService} from "./services/auth-guards/op-auth-guard.service";
import {SendGymInviteComponent} from "./pages/app-auth/create-gym/send-gym-invite.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {BrowserModule} from "@angular/platform-browser";
import {PhoneMaskDirective} from "./phone-mask.directive";
import {CreateGymInviteConfirmationComponent} from "./create-gym-confirmation/create-gym-invite-confirmation.component";
import {ListGymInvitesComponent} from "./list-gyms/list-gym-invites.component";
import {GymSignupComponent} from "./gym-signup/gym-signup.component";
import {OpsRootComponent} from "./ops-root/ops-root.component";
import {GymAuthGuardGuard} from "./services/auth-guards/gym-auth-guard.guard";
import {completePageRoutes, pageSubroutes} from "./app-routing.consts";
import {GymRootComponent} from "./gym-root/gym-root.component";
import {ListCheckinsComponent} from "./list-checkins/list-checkins.component";
import {GymSetupComponent} from "./gym-setup/gym-setup.component";
import {SetupGuard} from "./setup.guard";
import {SetupResolver} from "./setup.resolver";

const routes: Routes = [
  { path: 'oplogin', component: OpLoginPageComponent},
  { path: 'signup', component: GymSignupComponent},
  { path: 'app', component: AppRootComponent, canActivateChild: [GymAuthGuardGuard], canActivate: [GymAuthGuardGuard],
  children: [
    // Route:    /app/ops
    { path: 'ops', component: OpsRootComponent, canActivateChild: [OpAuthGuardService],
      children: [
        { path: '', redirectTo: pageSubroutes.sendGymInvite, pathMatch: 'prefix'},
        { path: pageSubroutes.sendGymInvite, component: SendGymInviteComponent, },
        { path: pageSubroutes.sendGymInviteConfirmation + '/:id', component: CreateGymInviteConfirmationComponent, },
        { path: pageSubroutes.listGymInvites, component: ListGymInvitesComponent, },
      ]},
    // Route:    /app/gym
    { path: 'gym', component: GymRootComponent, canActivateChild: [GymAuthGuardGuard],
      children: [
        { path: '', redirectTo: pageSubroutes.listCheckins, pathMatch: 'prefix'},
        { path: pageSubroutes.listCheckins, component: ListCheckinsComponent, },
      ]},
    // Route:    /app/setup

  ]},
  { path: 'setup',  redirectTo: 'setup/', pathMatch: 'full'},
  { path: 'setup/:id', component: GymSetupComponent, canActivate: [SetupGuard], resolve: {setup: SetupResolver}},
  { path: '**', component: MarketingSiteHomePageComponent},
];

@NgModule({
  imports: [FormsModule, ReactiveFormsModule, CommonModule, BrowserModule, RouterModule.forRoot(routes, {
    urlUpdateStrategy: 'eager'
  })],
  declarations: [
    SendGymInviteComponent,
    PhoneMaskDirective
  ],
  exports: [RouterModule, SendGymInviteComponent, PhoneMaskDirective],
  providers: [SetupResolver]
})
export class AppRoutingModule { }
