enum AccessLevels {
  DEFAULT = 'user.default',
  DASHBOARD_SIGNUP = 'user.dashboard.default',
  DASHBOARD_SUBSCRIBER_BASIC = 'user.dashboard.subscriber.basic',
  DASHBOARD_SUBSCRIBER_PRO = 'user.dashboard.subscriber.pro',
  DASHBOARD_SUBSCRIBER_PREMIUM = 'user.dashboard.subscriber.premium',
  DASHBOARD_SUBSCRIBER_AGENCY = 'user.dashboard.subscriber.agency',
  EMAIL_VERIFIED = 'user.verified.email',
  EMAIL_VERIFIED_MISSING_PROPERTIES = 'user.verified.email.missing.props',
  MOBILE_VERIFIED = 'user.verified.mobile',
  SUPER_ADMIN = 'user.admin.super',
  ORGANIZATIONS_ADMIN = 'user.organizations.admin',
  ORGANIZATIONS_BILLING = 'user.organizations.billing',
  ORGANIZATIONS_MANAGER = 'user.organizations.manager',
  ORGANIZATIONS_READ = 'user.organizations.read',
}

export default AccessLevels;
