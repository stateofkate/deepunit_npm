import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingSiteHomePageComponent } from './marketing-site-home-page.component';

describe('MarketingSiteHomeComponent', () => {
  let component: MarketingSiteHomePageComponent;
  let fixture: ComponentFixture<MarketingSiteHomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MarketingSiteHomePageComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MarketingSiteHomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
