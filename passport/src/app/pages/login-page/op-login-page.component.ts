import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, FormControl, Validators, UntypedFormBuilder }
  from '@angular/forms';
import {filter, map, take} from "rxjs/operators";
import {AuthService} from "../../services/auth/auth.service";
import {Router} from "@angular/router";
import {HttpClient} from "@angular/common/http";
import {RequestService} from "../../services/request-service/request.service";
import {accountType, oploginData} from "../../services/request-service/request-service.consts";
@Component({
  selector: 'app-login-page',
  templateUrl: './op-login-page.component.html',
  styleUrls: ['./op-login-page.component.scss']
})
//Great best practices: https://web.dev/sign-in-form-best-practices/
export class OpLoginPageComponent implements OnInit {

  public loginError: boolean = false
  public form: UntypedFormGroup;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private authService: AuthService,
    private router: Router,
    private requestService: RequestService) {
    this.form = formBuilder.group({
      /* Frankly emails should not be so complicated, but there is quite a bit of detail to the spec...
      email max length: https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
      https://stackoverflow.com/a/719543*/
      "email": [
        "justin@thefitpassport.com",
        //"",//todo: remove this for prod
        [Validators.pattern("^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"), Validators.maxLength(255)]], //https://stackoverflow.com/a/719543
      "password":[
        "12345#67890"
        //"" //todo: remove this for prod
        , [Validators.required, Validators.minLength(8), Validators.maxLength(100)]] //Honestly who would want a password over 100 characters?
  });
  }



  public ngOnInit(): void {
    if(this.authService.isAuthenticated()) {
      this.router.navigate(["/app"]);
    }
  }
/*
we could be so fancy, but we dont need to
  public ngOnInit(): void {
    this.form.valueChanges
      .pipe(
        map((value) => {
          console.log(value)
          console.log(this.form.get('email')?.errors)
          return value;
        }),
      )
      .subscribe((value) => {
        console.log("Reactive Form valid value: vm = ",
          JSON.stringify(value));
      });
  }*/

  public onSubmit() {
    this.loginError = false;
    console.log("reactive form submitted");
    console.log(this.form.value);
    const usernameObject = JSON.stringify({accountType: accountType.ops, username: this.form.value.email})

    const data: oploginData = {username: usernameObject, password: this.form.value.password}
      this.requestService.oplogin(data).pipe(take(1)).subscribe((data: any) => {
      console.log('we have a response');
      console.log(data)
      if(data.access_token) {
        this.authService.authenticate(data.access_token, data.user)
        this.router.navigate(["/app"])
      }
    }, err => {this.loginError = true})
    //this.authService.authenticate(true)
    //this.router.navigate(['/app'])
  }

  public testFunction(input: string) {
    if(input === '5') {
      console.log('thats weird')
    } else {
      console.log('fine')
    }
  }
}
