import { TestBed } from '@angular/core/testing';

import { OpAuthGuardService } from './op-auth-guard.service';

describe('OpAuthGuardService', () => {
  let service: OpAuthGuardService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OpAuthGuardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
