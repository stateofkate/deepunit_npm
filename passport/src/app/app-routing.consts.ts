export const appBaseURL = 'app'
export const appURL = '/' + appBaseURL
export const rootUrl = ''


export const pageSubroutes = {
  sendGymInvite: 'send-gym-invite',
  sendGymInviteConfirmation: 'send-gym-invite-confirmation',
  listGymInvites: 'list-gym-invites',
  listCheckins: 'list-checkins',
  setup: 'setup',
}

export const authenticatedRoutes = {
  ops: appBaseURL + '/ops',
  gym: appBaseURL + '/gym',
  members: appBaseURL + '/members',
  setup: '/' + pageSubroutes.setup
}

export const unauthenticatedRoutes = {
  signup: '/signup',
  oplogin: '/oplogin'
}

export const pageRoutes = {

}
export const completePageRoutes = {
  memberBase: authenticatedRoutes.members,
  sendGymInvitePage: authenticatedRoutes.ops + '/' + pageSubroutes.sendGymInvite,
  listGymInvitesPage: authenticatedRoutes.ops + '/' + pageSubroutes.listGymInvites,
  listCheckins: authenticatedRoutes.gym +'/' + pageSubroutes.listCheckins
}
