import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, ActivatedRouteSnapshot, Router} from "@angular/router";
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
export class GymSignupComponent implements OnInit {
  public form: UntypedFormGroup;
  public submissionError: boolean = false

  public code: string | null  = '';
  public problem: string | undefined;
  public formIsTouched: boolean = false;
  public formErrorMessage: string = '';
  public formErrorMessageSubscription: Subscription;

  constructor(
    private activatedRoute: ActivatedRoute,
    private requestService: RequestService,
    private formBuilder: UntypedFormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = formBuilder.group({
      /* Frankly emails should not be so complicated, but there is quite a bit of detail to the spec...
      email max length: https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
      https://stackoverflow.com/a/719543*/
      "email": [
        "",
        //"",//todo: remove this for prod
        [Validators.pattern("^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"), Validators.maxLength(255)]], //https://stackoverflow.com/a/719543
      "name": [
        "",
        //"",//todo: remove this for prod
        [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
      "password":[
        ""
        //"" //todo: remove this for prod
        , [Validators.required, Validators.minLength(8), Validators.maxLength(100)]] //Honestly who would want a password over 100 characters?
    });
    this.code = this.activatedRoute.snapshot.queryParamMap.get('code');
    this.authService.logout(false)
  }

      public ngOnInit(): void {
        console.log(this.code)
        //todo: logout the user in case
        if(this.code === null) {
          this.problem = 'We were not able to get your invite code from the email. Please give us a call at (408) 888-9792 so we can get this fixed for you, or send an email to ';
        } else {
          //todo: make this populate the email field
          this.requestService.getInvite(this.code).pipe(take(1)).subscribe((data) => {
            //this.form.value.email = data.email;
          }, (error) => {
            this.problem = 'Something went wrong, please reload the page. If that doesn\'t fix the issue Please give us a call at (408) 888-9792 so we can get this fixed for you, or send an email to '
            console.error(error)
          })
        }

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
      this.requestService.createGymFromInvite(signupInfo).pipe(take(1)).subscribe((data: { access_token?: string, user?: any}) => {
        if(data.access_token) {
          this.authService.authenticate(data.access_token, data.user)
          this.router.navigate([authenticatedRoutes.setup])
        }
      })
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
        inputsInvalid.push('address')
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
