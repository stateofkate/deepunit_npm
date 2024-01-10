import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GymRootComponent } from './gym-root.component';

describe('GymRootComponent', () => {
  let component: GymRootComponent;
  let fixture: ComponentFixture<GymRootComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GymRootComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GymRootComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
