import {Component, isDevMode, OnInit} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {RequestService} from "../services/request-service/request.service";
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs";
import {concatMap, switchMap, take} from "rxjs/operators";

@Component({
  selector: 'app-create-gym-invite-confirmation',
  templateUrl: './create-gym-invite-confirmation.component.html',
  styleUrls: ['./create-gym-invite-confirmation.component.scss']
})
export class CreateGymInviteConfirmationComponent implements OnInit {
  public inviteData: any = {};

  constructor(private requestService: RequestService,
              private router: Router,
              private activatedRoute: ActivatedRoute
  ) { }
  public ngOnInit(): void {

   this.activatedRoute.params.pipe(
     switchMap((data) => { return this.requestService.verifyCode(data.id) }),
     take(1) //take() placement in the observable chain DOES matter or you get memory leaks https://itnext.io/where-to-place-rxjs-operator-take-1-39a8a00f65cb
   ).subscribe((data) => {
     this.inviteData = data
   });

  }
  public singALittleSong(singer: string) {
    let url = 'youtube.com'
    if(singer === "Michael Jackson") {
      url = 'https://www.youtube.com/watch?v=sOnqjkJTMaA'
    } else if(singer === 'Rick Astley') {
      url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    } else if(singer === 'Drake') {
      url = 'https://www.youtube.com/watch?v=uxpDa-c-4Mc'
    }
    window.open(url)
  }
  public goBackToCreateGym() {
    this.router.navigate(['app/send-gym-invite'])
  }



}
