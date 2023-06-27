enum AccessLevels {
  DEFAULT = 'user.default',
  DASHBOARD_SIGNUP = 'user.dashboard.default',
  EMAIL_VERIFIED = 'user.verified.email',
  EMAIL_VERIFIED_MISSING_PROPERTIES = 'user.verified.email.missing.props',
  MOBILE_VERIFIED = 'user.verified.mobile',
  SUPER_ADMIN = 'user.admin.super'
}

export default AccessLevels;
