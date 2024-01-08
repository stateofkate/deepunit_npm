import {Injectable} from '@angular/core';
import {Router} from "@angular/router";
import {accountType, userTablePrefixs} from "../request-service/request-service.consts";
import {RequestService} from "../request-service/request.service";
import * as jwt_decode from "jwt-decode";
import jwtDecode from "jwt-decode";

interface userAuthData {
  userType: accountType | undefined;
  user: any;
  authToken: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
/**
 * All user data should be stored in authData so that we can cleanly and easily delete it on logout. Please add all preperties to that object.
 */
  private readonly emptyData = {
    authToken: '',
    user: {},
    userType: undefined,
  }
  private authData: userAuthData = this.emptyData;
  constructor(
    private router: Router,
  ) {
    const localKey = localStorage.getItem('tfpjw');
    if(localKey) {
      this.authData.authToken = localKey
      const localUser = jwtDecode(this.authData.authToken)
      console.log(localUser)
      if(localUser) {
        this.authData.user = localUser
      }
    }
  }

  public authenticate(token: string, user: {}) {
    this.logout(false)
    this.authData.authToken = 'Bearer ' + token;
    localStorage.setItem('tfpjw', this.authData.authToken)
    this.authData.user = user;
    localStorage.setItem('tfpjwuser', JSON.stringify(this.authData.user))
  }

  public isAuthenticated(): boolean {
    //maybe add some logic later
    return !!this.authData.authToken;
  }

  public getUserType() {
    if(this.authData.userType) {
      return this.authData.userType;
    }
    this.authData.userType = this.determineUserType();
    return this.authData.userType;
  }
  public determineUserType(): accountType | undefined {
    const tablePrefix = this.authData.user?.id?.substring(0, 4);
    switch(tablePrefix) {
      case(userTablePrefixs.ops):
        return accountType.ops;
      case(userTablePrefixs.gym):
        return accountType.gym;
      case(userTablePrefixs.member):
        return accountType.member;
      default:
        console.error('unknown user type, this is an error which should never happen');
        console.error(tablePrefix)
        return undefined;
    }
  }

  public getAuthToken() {
    return this.authData.authToken;
  }

  public logout(navigateToLoginPage: boolean = true) {
    localStorage.removeItem('tfpjw');
    localStorage.removeItem('tfpjwuser');
    this.authData = this.emptyData;
    if(navigateToLoginPage) {
      this.router.navigate(["/oplogin"])
    }
  }

  public isGym() {
    return this.getUserType() === accountType.gym;
  }
  public isOps() {
    return this.getUserType() === accountType.ops;
  }

  public isMember() {
    return this.getUserType() === accountType.member;
  }
}
