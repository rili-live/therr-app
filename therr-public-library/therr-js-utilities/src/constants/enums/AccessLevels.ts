enum AccessLevels {
  DEFAULT = 'user.default',
  DASHBOARD_SIGNUP = 'user.dashboard.default',
  DASHBOARD_SUBSCRIBER_BASIC = 'user.dashboard.subscriber.basic',
  DASHBOARD_SUBSCRIBER_PRO = 'user.dashboard.subscriber.pro',
  DASHBOARD_SUBSCRIBER_PREMIUM = 'user.dashboard.subscriber.premium',
  EMAIL_VERIFIED = 'user.verified.email',
  EMAIL_VERIFIED_MISSING_PROPERTIES = 'user.verified.email.missing.props',
  MOBILE_VERIFIED = 'user.verified.mobile',
  SUPER_ADMIN = 'user.admin.super'
}

export default AccessLevels;
