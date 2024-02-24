import {Injectable, isDevMode} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {createGymInviteData, gymUpdateFields, listGymInviteFilters, oploginData} from "./request-service.consts";

@Injectable({
  providedIn: 'root'
})
export class RequestService {
  private baseUrl: string = '';

  constructor(private httpClient: HttpClient) {
    this.baseUrl = isDevMode() ? 'http://localhost:8080/' : 'http://thefitpassport.com';
  }

  private post(url: string, data: any) {
    const fullUrl = this.baseUrl + url;
    return this.httpClient.post(fullUrl, data)
  }

  private postWithOptions(url: string, data: any, options?: any) {
    const fullUrl = this.baseUrl + url;
    return this.httpClient.post(fullUrl, data, options)
  }
  private get(url: string, data?: any) {
    const fullUrl = this.baseUrl + url;
    return this.httpClient.get(fullUrl, data)
  }

  public createGymInvite(data: createGymInviteData) {
    const apiPath = 'gym-invite/create'
    return this.post(apiPath, data);
  }

  public oplogin(data: oploginData) {
    const apiPath = 'oplogin/login';
    return this.post(apiPath, data)
  }

  public opImpersonate(data: any) {
    const apiPath = 'oplogin/impersonate';
    return this.post(apiPath, data)
  }

  public generateTest(data: any) {
    const apiPath = 'generate-test/new';
    return this.post(apiPath, data)
  }

  public verifyCode(id: string) {
    const apiPath = 'gym-invite/' + id
    return this.get(apiPath)
  }

  public listGymInvites(data?: listGymInviteFilters) {
    const apiPath = 'gym-invite/list'
    return this.post(apiPath, data)
  }

  public createGymFromInvite(signupInfo: { password: string; inviteCode?: string | null; name: string; email: string }) {
    const apiPath = 'gym/create-from-invite'
    return this.post(apiPath, signupInfo)
  }

  public getGym() {
    const apiPath = 'gym/get';
    return this.get(apiPath)
  }

  public createGym(data: { website: string; address: string; phone: string; name: string; description: string }) {
    const apiPath = 'gym/create';
    return this.post(apiPath, data)
  }

  public updateGym(data: gymUpdateFields) {
    const apiPath = 'gym/update';
    return this.post(apiPath, data)
  }

  public uploadMultipleGymPhotos(files: any) {
    const apiPath = 'gym/photouploadmultiple';
    return this.postWithOptions(apiPath, files, {reportProgress: true, observe: 'events'})
  }

  public uploadWaiver(files: any) {
    const apiPath = 'gym/waiverUpload';
    return this.postWithOptions(apiPath, files, {reportProgress: true, observe: 'events'})
  }
}
