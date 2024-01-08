import { Component, OnInit } from '@angular/core';
import {UntypedFormBuilder, UntypedFormGroup, Validators} from "@angular/forms";
import {AuthService} from "../../../services/auth/auth.service";
import {Router} from "@angular/router";
import {map, take} from "rxjs/operators";
import {RequestService} from "../../../services/request-service/request.service";

@Component({
  selector: 'send-gym-invite',
  templateUrl: './send-gym-invite.component.html',
  styleUrls: ['./send-gym-invite.component.scss']
})
export class SendGymInviteComponent implements OnInit {

  public submissionError: boolean = false
  public form: UntypedFormGroup;
  public backendError: string = '';
  constructor(
    private formBuilder: UntypedFormBuilder,
    private authService: AuthService,
    private router: Router,
    private requestService: RequestService
  ) {
    this.form = formBuilder.group({
      /* Frankly emails should not be so complicated, but there is quite a bit of detail to the spec...
      email max length: https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
      https://stackoverflow.com/a/719543*/
      "email": ["justin@thefitpassport.com", [Validators.required, Validators.pattern("^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"), Validators.maxLength(255)]], //https://stackoverflow.com/a/719543
      "phone":["", [Validators.required, Validators.minLength(14), Validators.maxLength(14)]] //US numbers only
    });
  }
  //we could be so fancy, but we dont need to
    public ngOnInit(): void {/*
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
        });*/
    }

      public onSubmit() {
        this.submissionError = false;
        this.backendError = '';
        console.log("reactive form submitted");
        console.log(this.form.value);
          this.requestService.createGymInvite({email: this.form.value.email, phone: this.form.value.phone}).pipe(take(1)).subscribe((data: any) => {
          console.log('we have a response');
          console.log(data)
          if(!data.sent) {
            this.backendError = data.message;
          } else {
            this.router.navigate(['/app/send-gym-invite-confirmation/' + data.gymInvite.id])
          }
        }, err => {this.submissionError = true})
        //this.authService.authenticate(true)
        //this.router.navigate(['/app'])
      }

}
