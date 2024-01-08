import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateGymInviteConfirmationComponent } from './create-gym-invite-confirmation.component';
import { ActivatedRoute } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

describe('CreateGymConfirmationComponent', () => {
  let component: CreateGymInviteConfirmationComponent;
  let fixture: ComponentFixture<CreateGymInviteConfirmationComponent>;

  beforeEach(async () => {
    const activatedRouteMock = {
      params: of({ id: 123 })
    };

    await TestBed.configureTestingModule({
      declarations: [CreateGymInviteConfirmationComponent],
      providers: [
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ],
      imports: [HttpClientTestingModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateGymInviteConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Test cases
})