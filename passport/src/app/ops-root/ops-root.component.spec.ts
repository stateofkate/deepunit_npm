import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpsRootComponent } from './ops-root.component';

describe('OpsRootComponent', () => {
  let component: OpsRootComponent;
  let fixture: ComponentFixture<OpsRootComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OpsRootComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OpsRootComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
