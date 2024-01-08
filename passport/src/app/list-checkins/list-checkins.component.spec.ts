import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListCheckinsComponent } from './list-checkins.component';

describe('ListCheckinsComponent', () => {
  let component: ListCheckinsComponent;
  let fixture: ComponentFixture<ListCheckinsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ListCheckinsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ListCheckinsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
