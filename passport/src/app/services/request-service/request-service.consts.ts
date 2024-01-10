export type oploginData = {
  username: string; //for reasons(nestjs auth strategy) we must call it username, even tho it's really an email address.. ok now for other reasons we are stringifying a json
  password: string;
}

export type createGymInviteData = {
  email: string;
  phone: string;
}
export type listGymInviteFilters = {
  email?: string;
  phone?: string;
  orderBy?: {}
}
export type gymUpdateFields = {
  id: string;
  tuesdayClose?: any;
  mondayClose?: any;
  tuesdayOpen?: any;
  sundayClose?: any;
  mondayOpen?: any;
  wednesdayOpen?: any;
  fridayClose?: any;
  thursdayClose?: any;
  saturdayOpen?: any;
  currentStep?: string;
  fridayOpen?: any;
  sundayOpen?: any;
  wednesdayClose?: any;
  thursdayOpen?: any;
  saturdayClose?: any;
  holidaySchedule?: any
}

export enum accountType {
  ops = 'ops',
  gym = 'gym',
  member = 'member'
}
export enum userTablePrefixs {
  ops = 'opus',
  gym = 'gymu',
  member = 'memb'
}
