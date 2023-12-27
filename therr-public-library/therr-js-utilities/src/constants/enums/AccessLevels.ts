enum AccessLevels {
  DEFAULT = 'user.default', // Added on sign-up from web or mobile app
  DASHBOARD_SIGNUP = 'user.dashboard.default', // Added on sign-up from web dashboard
  DASHBOARD_SUBSCRIBER_BASIC = 'user.dashboard.subscriber.basic', // Added in Payment processor webhooks when user subscribes
  DASHBOARD_SUBSCRIBER_PRO = 'user.dashboard.subscriber.pro', // Added in Payment processor webhooks when user subscribes
  DASHBOARD_SUBSCRIBER_PREMIUM = 'user.dashboard.subscriber.premium', // Added in Payment processor webhooks when user subscribes
  DASHBOARD_SUBSCRIBER_AGENCY = 'user.dashboard.subscriber.agency', // Added in Payment processor webhooks when user subscribes
  /**
   * Added after successfully verifying email before required user properties are included
   */
  EMAIL_VERIFIED_MISSING_PROPERTIES = 'user.verified.email.missing.props',
  EMAIL_VERIFIED = 'user.verified.email', // Added after successfully verifying email and required user properties are included
  MOBILE_VERIFIED = 'user.verified.mobile', // Added after successfully verify phone number
  SUPER_ADMIN = 'user.admin.super', // Added manually to Therr admins
  ORGANIZATIONS_ADMIN = 'user.organizations.admin', // Default role for organization creator
  ORGANIZATIONS_BILLING = 'user.organizations.billing', // Assigned by organization admin when adding a billing user
  ORGANIZATIONS_MANAGER = 'user.organizations.manager', // Assigned by organization admin when adding a manager user
  ORGANIZATIONS_READ = 'user.organizations.read', // Assigned by organization admin when adding a read only user
  // eslint-disable-next-line max-len
  ORGANIZATIONS_SUBSCRIBER = 'user.organizations.subscriber', // Assigned by white-label organization admin when adding a subscriber/customer
}

export default AccessLevels;
