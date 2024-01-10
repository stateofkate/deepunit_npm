import { Component, OnInit } from '@angular/core';
import { RequestService } from '../services/request-service/request.service';
import { take, takeUntil, tap } from 'rxjs/operators';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  Router,
} from '@angular/router';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import {
  accountType,
  userTablePrefixs,
} from '../services/request-service/request-service.consts';
import { BehaviorSubject, Subscription } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-gym-setup',
  templateUrl: './gym-setup.component.html',
  styleUrls: ['./gym-setup.component.scss'],
})
export class GymSetupComponent implements OnInit {
  public readonly numberOfSteps: number = 6;
  public stepOne: number = 1;
  public currStep: number = 1;
  public formOne: UntypedFormGroup;
  public formTwo: UntypedFormGroup;
  public formThree: UntypedFormGroup;
  public formSix: UntypedFormGroup;
  public formOneIsTouched: boolean = false;
  public formTwoIsTouched: boolean = false;
  public formSixIsTouched: boolean = false;

  public gymToSetup: any = {};
  public formTwoErrorMessage: string = '';
  public formTwoErrorMessageSubscription: Subscription;
  public formOneErrorMessageSubscription: Subscription;
  public formOneErrorMessage: string = '';
  public photos: File[] = [];
  private progressSource = new BehaviorSubject<number>(0);
  public progress$ = this.progressSource.asObservable();
  public waiver: File;

  constructor(
    private requestService: RequestService,
    private activatedRoute: ActivatedRoute,
    private formBuilder: UntypedFormBuilder,
    private ngxSpinner: NgxSpinnerService,
    private router: Router
  ) {
    if (
      this.activatedRoute.snapshot.data.setup.gyms.length > 0 &&
      this.activatedRoute.snapshot.params.id
    ) {
      this.activatedRoute.snapshot.data.setup.gyms.forEach((gym: any) => {
        if (gym.id === this.activatedRoute.snapshot.params.id) {
          this.gymToSetup = gym;
        }
      });
    }
    if (
      this.gymToSetup &&
      !this.activatedRoute.snapshot.data?.setup?.setupComplete
    ) {
      //todo: test this code path with a fully setup gym. Can't be done yet due to not having fully setup gyms done
      switch (this.gymToSetup.setupState) {
        case 'step1':
          this.stepOne = 2;
          this.currStep = 2;
          break;
        case 'step2':
          this.stepOne = 3;
          this.currStep = 3;
          break;
        case 'step3':
          this.stepOne = 4;
          this.currStep = 4;
          break;
        case 'step4':
          this.stepOne = 5;
          this.currStep = 5;
          break;
        case 'step5':
          this.stepOne = 6;
          this.currStep = 6;
          break;
      }
    }

    this.formOne = this.formBuilder.group({
      name: [this.gymToSetup?.name, [Validators.required]],
      phone: [
        this.gymToSetup?.phone,
        [Validators.required, Validators.minLength(10)],
      ],
      address: [this.gymToSetup?.address, [Validators.required]],
      website: [this.gymToSetup?.website],
      description: [this.gymToSetup?.description, [Validators.required]],
    });
    this.gymToSetup.mondayOpen = this.dateToTime(this.gymToSetup?.mondayOpen);
    this.gymToSetup.mondayClose = this.dateToTime(this.gymToSetup?.mondayClose);
    this.gymToSetup.tuesdayOpen = this.dateToTime(this.gymToSetup?.tuesdayOpen);
    this.gymToSetup.tuesdayClose = this.dateToTime(
      this.gymToSetup?.tuesdayClose
    );
    this.gymToSetup.wednesdayOpen = this.dateToTime(
      this.gymToSetup?.wednesdayOpen
    );
    this.gymToSetup.wednesdayClose = this.dateToTime(
      this.gymToSetup?.wednesdayClose
    );
    this.gymToSetup.thursdayOpen = this.dateToTime(
      this.gymToSetup?.thursdayOpen
    );
    this.gymToSetup.thursdayClose = this.dateToTime(
      this.gymToSetup?.thursdayClose
    );
    this.gymToSetup.fridayOpen = this.dateToTime(this.gymToSetup?.fridayOpen);
    this.gymToSetup.fridayClose = this.dateToTime(this.gymToSetup?.fridayClose);
    this.gymToSetup.saturdayOpen = this.dateToTime(
      this.gymToSetup?.saturdayOpen
    );
    this.gymToSetup.saturdayClose = this.dateToTime(
      this.gymToSetup?.saturdayClose
    );
    this.gymToSetup.sundayOpen = this.dateToTime(this.gymToSetup?.sundayOpen);
    this.gymToSetup.sundayClose = this.dateToTime(this.gymToSetup?.sundayClose);

    this.formTwo = this.formBuilder.group({
      mondayOpen: [this.gymToSetup?.mondayOpen, [Validators.required]],
      mondayClose: [this.gymToSetup?.mondayClose, [Validators.required]],
      tuesdayOpen: [this.gymToSetup?.tuesdayOpen, [Validators.required]],
      tuesdayClose: [this.gymToSetup?.tuesdayClose, [Validators.required]],
      wednesdayOpen: [this.gymToSetup?.wednesdayOpen, [Validators.required]],
      wednesdayClose: [this.gymToSetup?.wednesdayClose, [Validators.required]],
      thursdayOpen: [this.gymToSetup?.thursdayOpen, [Validators.required]],
      thursdayClose: [this.gymToSetup?.thursdayClose, [Validators.required]],
      fridayOpen: [this.gymToSetup?.fridayOpen, [Validators.required]],
      fridayClose: [this.gymToSetup?.fridayClose, [Validators.required]],
      saturdayOpen: [this.gymToSetup?.saturdayOpen, [Validators.required]],
      saturdayClose: [this.gymToSetup?.saturdayClose, [Validators.required]],
      sundayOpen: [this.gymToSetup?.sundayOpen, [Validators.required]],
      sundayClose: [this.gymToSetup?.sundayClose, [Validators.required]],
      holidaySchedule: [
        this.gymToSetup?.holidaySchedule,
        [Validators.maxLength(2000)],
      ],
    });

    this.formThree = this.formBuilder.group({
      additionalAmenities: [
        this.gymToSetup?.additionalAmenities,
        [Validators.required],
      ],
    });

    this.formSix = this.formBuilder.group({
      memberCountEstimate: [
        this.gymToSetup?.memberCountEstimate,
        [Validators.required],
      ],
    });
  }

  public dateToTime(dateString: any): string {
    if (!dateString) {
      return dateString;
    }
    const time: string = dateString.substring(11, 16);
    return time;
  }
  public ngOnInit(): void {}
  public stepOneContinue() {
    if (this.formOne.invalid) {
      this.formOneIsTouched = true;
      console.error('formOne is invalid');
      this.generateFormOneError();

      if (!this.formOneErrorMessageSubscription) {
        //avoid multiple subscriptions
        this.formOneErrorMessageSubscription =
          this.formOne.statusChanges.subscribe((data) => {
            this.generateFormOneError(data);
          });
      }
      return;
    }
    this.formOneIsTouched = false;
    let gymData = {
      name: this.formOne.value.name,
      phone: this.formOne.value.phone,
      address: this.formOne.value.address,
      website: this.formOne.value.website,
      description: this.formOne.value.description,
      id: this.gymToSetup.id,
    };
    if (this.gymToSetup.id) {
      this.requestService
        .updateGym(gymData)
        .pipe(take(1))
        .subscribe((data) => {});
    } else {
      this.requestService
        .createGym(gymData)
        .pipe(take(1))
        .subscribe((data: any) => {
          if (data.gyms[0]) {
            this.gymToSetup = data.gyms[0];
          }
        });
    }
    this.advanceStep(1);
  }
  public generateFormOneError(data?: string) {
    if (data === 'VALID') {
      this.formOneErrorMessage = '';
      if (this.formOneErrorMessageSubscription) {
        this.formOneErrorMessageSubscription.unsubscribe();
      } //since the form is valid we can stop calculating the error message
      return;
    }
    let formOneErrorMessage = 'Please enter your ';
    let inputsInvalid = [];
    if (this.formOne.controls.name.invalid) {
      inputsInvalid.push('gym name');
    }
    if (this.formOne.controls.phone.invalid) {
      inputsInvalid.push('gym phone number');
    }
    if (this.formOne.controls.address.invalid) {
      inputsInvalid.push('address');
    }
    if (this.formOne.controls.description.invalid) {
      inputsInvalid.push('description');
    }
    for (let i = 0; i < inputsInvalid.length; i++) {
      if (i === inputsInvalid.length - 1) {
        formOneErrorMessage += inputsInvalid[i] + '.';
      } else if (i === inputsInvalid.length - 2) {
        formOneErrorMessage += inputsInvalid[i] + ' and ';
      } else {
        formOneErrorMessage += inputsInvalid[i] + ', ';
      }
    }
    this.formOneErrorMessage = formOneErrorMessage;
  }

  public generateFormTwoError(data?: string) {
    if (data === 'VALID') {
      this.formTwoErrorMessage = '';
      if (this.formTwoErrorMessageSubscription) {
        this.formTwoErrorMessageSubscription.unsubscribe();
      } //since the form is valid we can stop calculating the error message
      return;
    }
    let formTwoErrorMessage = 'Please enter a time for ';
    let inputsInvalid = [];
    if (this.formTwo.controls.mondayOpen.invalid) {
      inputsInvalid.push('monday opening');
    }
    if (this.formTwo.controls.mondayClose.invalid) {
      inputsInvalid.push('monday closing');
    }
    if (this.formTwo.controls.tuesdayOpen.invalid) {
      inputsInvalid.push('tuesday opening');
    }
    if (this.formTwo.controls.tuesdayClose.invalid) {
      inputsInvalid.push('tuesday closing');
    }
    if (this.formTwo.controls.wednesdayOpen.invalid) {
      inputsInvalid.push('wednesday opening');
    }
    if (this.formTwo.controls.wednesdayClose.invalid) {
      inputsInvalid.push('wednesday closing');
    }
    if (this.formTwo.controls.thursdayOpen.invalid) {
      inputsInvalid.push('thursday opening');
    }
    if (this.formTwo.controls.thursdayClose.invalid) {
      inputsInvalid.push('thursday closing');
    }
    if (this.formTwo.controls.fridayOpen.invalid) {
      inputsInvalid.push('friday opening');
    }
    if (this.formTwo.controls.fridayClose.invalid) {
      inputsInvalid.push('friday closing');
    }
    if (this.formTwo.controls.saturdayOpen.invalid) {
      inputsInvalid.push('saturday opening');
    }
    if (this.formTwo.controls.saturdayClose.invalid) {
      inputsInvalid.push('saturday closing');
    }
    if (this.formTwo.controls.sundayOpen.invalid) {
      inputsInvalid.push('sunday opening');
    }
    if (this.formTwo.controls.sundayClose.invalid) {
      inputsInvalid.push('sunday closing');
    }
    for (let i = 0; i < inputsInvalid.length; i++) {
      if (i === inputsInvalid.length - 1) {
        formTwoErrorMessage += inputsInvalid[i] + '.';
      } else if (i === inputsInvalid.length - 2) {
        formTwoErrorMessage += inputsInvalid[i] + ' and ';
      } else {
        formTwoErrorMessage += inputsInvalid[i] + ', ';
      }
    }
    this.formTwoErrorMessage = formTwoErrorMessage;
  }
  public stepTwoContinue() {
    if (this.formTwo.invalid) {
      console.error('formTwo is invalid');
      this.generateFormTwoError();

      if (!this.formTwoErrorMessageSubscription) {
        //avoid multiple subscriptions
        this.formTwoErrorMessageSubscription =
          this.formTwo.statusChanges.subscribe((data) => {
            this.generateFormTwoError(data);
          });
      }
      this.formTwoIsTouched = true;
      return;
    }
    this.formTwoIsTouched = false;

    const hoursData = {
      id: this.gymToSetup.id,
      mondayOpen: this.gymToSetup.mondayClosed
        ? '12:00'
        : this.formTwo.value.mondayOpen,
      mondayClose: this.gymToSetup.mondayClosed
        ? '12:00'
        : this.formTwo.value.mondayClose,
      tuesdayOpen: this.gymToSetup.tuesdayClosed
        ? '12:00'
        : this.formTwo.value.tuesdayOpen,
      tuesdayClose: this.gymToSetup.tuesdayClosed
        ? '12:00'
        : this.formTwo.value.tuesdayClose,
      wednesdayOpen: this.gymToSetup.wednesdayClosed
        ? '12:00'
        : this.formTwo.value.wednesdayOpen,
      wednesdayClose: this.gymToSetup.wednesdayClosed
        ? '12:00'
        : this.formTwo.value.wednesdayClose,
      thursdayOpen: this.gymToSetup.thursdayClosed
        ? '12:00'
        : this.formTwo.value.thursdayOpen,
      thursdayClose: this.gymToSetup.thursdayClosed
        ? '12:00'
        : this.formTwo.value.thursdayClose,
      fridayOpen: this.gymToSetup.fridayClosed
        ? '12:00'
        : this.formTwo.value.fridayOpen,
      fridayClose: this.gymToSetup.fridayClosed
        ? '12:00'
        : this.formTwo.value.fridayClose,
      saturdayOpen: this.gymToSetup.saturdayClosed
        ? '12:00'
        : this.formTwo.value.saturdayOpen,
      saturdayClose: this.gymToSetup.satrudayClosed
        ? '12:00'
        : this.formTwo.value.saturdayClose,
      sundayOpen: this.gymToSetup.sundayClosed
        ? '12:00'
        : this.formTwo.value.sundayOpen,
      sundayClose: this.gymToSetup.sundayClosed
        ? '12:00'
        : this.formTwo.value.sundayClose,
      holidaySchedule: this.formTwo.value.holidaySchedule,
      setupState: 'step2',
    };
    this.requestService
      .updateGym(hoursData)
      .pipe(take(1))
      .subscribe((data) => {});
    this.advanceStep(2);
  }

  //pass the additional amentites value to the backend
  public stepThreeContinue() {
    const amenitiesData = {
      id: this.gymToSetup.id,
      additionalAmenities: this.formThree.value.additionalAmenities, //todo: maybe do the amenities bitmap? Do not confuse with amenties field saved for this
      setupState: 'step3',
    };

    this.requestService
      .updateGym(amenitiesData)
      .pipe(take(1))
      .subscribe((data) => {});
    this.advanceStep(3);
  }

  public stepSixContinue() {
    if (this.formSix.invalid) {
      this.formSixIsTouched = true;
      return;
    }
    this.formSixIsTouched = false;
    const membersData = {
      id: this.gymToSetup.id,
      memberCountEstimate: this.formSix.value.memberCountEstimate,
      setupState: 'step6',
      isSetup: true,
    };
    this.requestService
      .updateGym(membersData)
      .pipe(take(1))
      .subscribe((data) => {
        this.router.navigate(['/app/gym']);
      });
  }

  public advanceStep(callingStep: number) {
    console.log(callingStep, this.stepOne);
    //Sometimes advanceStep might be called multiple times, for eaxample if the upload in step 4 or 5 fails. We should skip the second time
    if (this.stepOne > callingStep) {
      return;
    }
    if (this.stepOne < this.numberOfSteps) {
      this.stepOne++;
    } else {
      this.stepOne = 1;
    }
    setTimeout(() => {
      if (this.currStep < this.numberOfSteps) {
        this.currStep++;
      } else {
        this.currStep = 1;
      }
    }, 250);
  }
  public goToStep(requestedStep: number) {
    if (
      requestedStep < this.stepOne &&
      requestedStep < this.currStep &&
      requestedStep < this.numberOfSteps
    ) {
      this.stepOne = requestedStep;
      setTimeout(() => {
        this.currStep = requestedStep;
      }, 250);
    }
  }

  public copyToAll() {
    const mondayOpen = this.gymToSetup.mondayClosed
      ? '12:00'
      : this.formTwo.value.mondayOpen;
    const mondayClose = this.gymToSetup.mondayClosed
      ? '12:00'
      : this.formTwo.value.mondayClose;
    this.gymToSetup.tuesdayOpen = mondayOpen;
    this.gymToSetup.tuesdayClose = mondayClose;
    this.gymToSetup.wednesdayOpen = mondayOpen;
    this.gymToSetup.wednesdayClose = mondayClose;
    this.gymToSetup.thursdayOpen = mondayOpen;
    this.gymToSetup.thursdayClose = mondayClose;
    this.gymToSetup.fridayOpen = mondayOpen;
    this.gymToSetup.fridayClose = mondayClose;
    this.gymToSetup.saturdayOpen = mondayOpen;
    this.gymToSetup.saturdayClose = mondayClose;
    this.gymToSetup.sundayOpen = mondayOpen;
    this.gymToSetup.sundayClose = mondayClose;
  }

  public boxChecked(event: any, day: string) {
    const closedTime = '12:00'; //probably does nothing
    if (event.target!.checked) {
      switch (day) {
        case 'monday':
          this.formTwo.controls.mondayOpen.disable();
          this.formTwo.controls.mondayClose.disable();
          this.gymToSetup.mondayOpen = closedTime;
          this.gymToSetup.mondayClose = closedTime;
          this.gymToSetup.mondayClosed = true;
          break;
        case 'tuesday':
          this.formTwo.controls.tuesdayOpen.disable();
          this.formTwo.controls.tuesdayClose.disable();
          this.gymToSetup.tuesdayOpen = closedTime;
          this.gymToSetup.tuesdayClose = closedTime;
          this.gymToSetup.tuesdayClosed = true;

          break;
        case 'wednesday':
          this.formTwo.controls.wednesdayOpen.disable();
          this.formTwo.controls.wednesdayClose.disable();
          this.gymToSetup.wednesdayOpen = closedTime;
          this.gymToSetup.wednesdayClose = closedTime;
          this.gymToSetup.wednesdayClosed = true;

          break;
        case 'thursday':
          this.formTwo.controls.thursdayOpen.disable();
          this.formTwo.controls.thursdayClose.disable();
          this.gymToSetup.thursdayOpen = closedTime;
          this.gymToSetup.thursdayClose = closedTime;
          this.gymToSetup.thursdayClosed = true;
          break;
        case 'friday':
          this.formTwo.controls.fridayOpen.disable();
          this.formTwo.controls.fridayClose.disable();
          this.gymToSetup.fridayOpen = closedTime;
          this.gymToSetup.fridayClose = closedTime;
          this.gymToSetup.fridayClosed = true;
          break;
        case 'saturday':
          this.formTwo.controls.saturdayOpen.disable();
          this.formTwo.controls.saturdayClose.disable();
          this.gymToSetup.saturdayOpen = closedTime;
          this.gymToSetup.saturdayClose = closedTime;
          this.gymToSetup.saturdayClosed = true;
          break;
        case 'sunday':
          this.formTwo.controls.sundayOpen.disable();
          this.formTwo.controls.sundayClose.disable();
          this.gymToSetup.sundayOpen = closedTime;
          this.gymToSetup.sundayClose = closedTime;
          this.gymToSetup.sundayClosed = true;
          break;
      }
    } else if (!event.target!.checked) {
      switch (day) {
        case 'monday':
          this.formTwo.controls.mondayOpen.enable();
          this.formTwo.controls.mondayClose.enable();
          this.gymToSetup.mondayClosed = false;
          break;
        case 'tuesday':
          this.formTwo.controls.tuesdayOpen.enable();
          this.formTwo.controls.tuesdayClose.enable();
          this.gymToSetup.tuesdayClosed = false;
          break;
        case 'wednesday':
          this.formTwo.controls.wednesdayOpen.enable();
          this.formTwo.controls.wednesdayClose.enable();
          this.gymToSetup.wednesdayClosed = false;
          break;
        case 'thursday':
          this.formTwo.controls.thursdayOpen.enable();
          this.formTwo.controls.thursdayClose.enable();
          this.gymToSetup.thursdayClosed = false;
          break;
        case 'friday':
          this.formTwo.controls.fridayOpen.enable();
          this.formTwo.controls.fridayClose.enable();
          this.gymToSetup.fridayClosed = false;
          break;
        case 'saturday':
          this.formTwo.controls.saturdayOpen.enable();
          this.formTwo.controls.saturdayClose.enable();
          this.gymToSetup.saturdayClosed = false;
          break;
        case 'sunday':
          this.formTwo.controls.sundayOpen.enable();
          this.formTwo.controls.sundayClose.enable();
          this.gymToSetup.sundayClosed = false;
          break;
      }
    }
  }

  public onFilesSelected(event: any) {
    this.photos = event.target.files;
  }

  public stepFourContinue() {
    if (this.photos && this.photos.length > 0) {
      const formData = new FormData();
      formData.append('gymId', this.gymToSetup.id);
      for (let i = 0; i < this.photos.length; i++) {
        formData.append('file', this.photos[i]);
      }
      this.ngxSpinner.show();
      //No unsubscribe here because lazy
      this.requestService
        .uploadMultipleGymPhotos(formData)
        .pipe(
          tap((event: any) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress =
                Math.round(((100 * event.loaded) / event.total) * 100) / 100;
              this.progressSource.next(progress);
            }
          })
        )
        .subscribe((data) => {
          if (data.loaded === data.total && data.loaded) {
            this.setStep('step4');
            this.ngxSpinner.hide();
            this.advanceStep(4);
            this.progressSource.next(0);
          }
        });
    } else {
      this.setStep('step4');
      this.advanceStep(4);
    }
  }

  public setStep(step: string) {
    const stepUpdateData = {
      id: this.gymToSetup.id,
      setupState: step,
    };
    this.requestService
      .updateGym(stepUpdateData)
      .pipe(take(1))
      .subscribe((data) => {});
  }

  public onLiabilityWaiverSelect(event: any) {
    this.waiver = event.target.files[0];
  }
  public stepFiveContinue() {
    if (this.waiver) {
      const formData = new FormData();
      formData.append('gymId', this.gymToSetup.id);
      formData.append('file', this.waiver);
      this.ngxSpinner.show();
      //No unsubscribe here because lazy
      this.requestService
        .uploadWaiver(formData)
        .pipe(
          tap((event: any) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress =
                Math.round(((100 * event.loaded) / event.total) * 100) / 100;
              this.progressSource.next(progress);
            }
          })
        )
        .subscribe((data) => {
          if (data.loaded === data.total && data.loaded) {
            this.setStep('step5');
            this.ngxSpinner.hide();
            this.advanceStep(5);
            this.progressSource.next(0);
          }
        });
    } else {
      this.setStep('step5');
      this.advanceStep(5);
    }
  }
}
