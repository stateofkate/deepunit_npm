import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, ActivatedRouteSnapshot} from "@angular/router";
import {RequestService} from "../services/request-service/request.service";
import {UntypedFormBuilder, UntypedFormGroup, Validators} from "@angular/forms";
import {take} from "rxjs/operators";
import {AuthService} from "../services/auth/auth.service";
import {authenticatedRoutes} from "../app-routing.consts";
import {Subscription} from "rxjs";

@Component({
  selector: 'app-gym-signup',
  templateUrl: './gym-signup.component.html',
  styleUrls: ['./gym-signup.component.scss']
})
export class GymSignupComponent {
  public form: UntypedFormGroup;
  public submissionError: boolean = false
  public code: string | null  = '';
  public errorMessage: string | undefined;
  public formIsTouched: boolean = false;
  public formErrorMessage: string = '';
  public formErrorMessageSubscription: Subscription;
  public verified: boolean = false;
  public problem: boolean = false;

  constructor(
    public activatedRoute: ActivatedRoute,
    public requestService: RequestService,
    public formBuilder: UntypedFormBuilder,
    public authService: AuthService,
  ) {
    this.form = formBuilder.group({
      /* Frankly emails should not be so complicated, but there is quite a bit of detail to the spec...
      email max length: https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
      https://stackoverflow.com/a/719543*/
      "email": [
        "",
        [Validators.required, Validators.pattern("^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"), Validators.maxLength(255)]], //https://stackoverflow.com/a/719543
      "name": [
        "",
        [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
      "password":[
        ""
        , [Validators.required, Validators.minLength(4), Validators.maxLength(100)]] //Honestly who would want a password over 100 characters?
    });
    this.code = this.activatedRoute.snapshot.queryParamMap.get('code');
    this.authService.logout(false)
  }

  public onSubmit() {
    if(this.form.invalid) {
      this.formIsTouched = true;
      console.error('form is invalid')
      this.generateFormError()

      if(!this.formErrorMessageSubscription) { //avoid multiple subscriptions
        this.formErrorMessageSubscription = this.form.statusChanges.subscribe((data) => {
            this.generateFormError(data)
          }
        )
      }
      return
    }
    const signupInfo = {
      email: this.form.value.email,
      password: this.form.value.password,
      name: this.form.value.name,
      inviteCode: this.code
    }
    this.requestService.createGymFromInvite(signupInfo).pipe(take(1)).subscribe(() => {})
  }
    
    
  public generateFormError(data?: string) {
    if(data === 'VALID') {
      this.formErrorMessage = '';
      if(this.formErrorMessageSubscription) {
        this.formErrorMessageSubscription.unsubscribe();
      } //since the form is valid we can stop calculating the error message
      return
    }
    let formErrorMessage = 'Please enter your ';
    let inputsInvalid =[];
    if(this.form.controls.name.invalid) {
      inputsInvalid.push('name')
    }
    if(this.form.controls.email.invalid) {
      inputsInvalid.push('email')
    }
    if(this.form.controls.password.invalid) {
      inputsInvalid.push('password')
    }
    for(let i = 0; i < inputsInvalid.length; i++) {
      if(i === inputsInvalid.length - 1) {
        formErrorMessage += inputsInvalid[i] + '.'
      } else if (i === inputsInvalid.length - 2) {
        formErrorMessage += inputsInvalid[i] + ' and '
      } else {
        formErrorMessage += inputsInvalid[i] + ', '
      }
    }
    this.formErrorMessage = formErrorMessage;
  }
}
