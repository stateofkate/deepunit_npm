import { Component, OnInit } from '@angular/core';
import {RequestService} from "../services/request-service/request.service";
import {take} from "rxjs/operators";

@Component({
  selector: 'app-list-gyms',
  templateUrl: './list-gym-invites.component.html',
  styleUrls: ['./list-gym-invites.component.scss']
})
export class ListGymInvitesComponent implements OnInit {
  public gymInvitelist: any = [];
  public columns: any = {id: false, phone: true, emailaddress: true, inviteCode: false, postmarkMessageID: false, state: true, createdByOpUserId: true, isactive: true, createddate: true}

  constructor(private requestService: RequestService) { }

    public ngOnInit(): void {
      this.requestService.listGymInvites({ orderBy: [
        {
          createddate: 'desc',
        }]}
        ).pipe((take(1))).subscribe((data: any) => {
          this.gymInvitelist = data.data;
      })
    }
    public toggleValue(key: any) {
      this.columns[key] = !this.columns[key];
    }
}
