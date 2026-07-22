enum MetricNames {
  // SPACES
  SPACE_VISIT = 'space.user.visit',
  SPACE_IMPRESSION = 'space.user.impression',
  SPACE_EVENT_CREATED = 'space.user.event',
  SPACE_MOMENT_CREATED = 'space.user.moment',
  SPACE_PROSPECT = 'space.user.prospect',
  SPACE_USER_CHECK_IN = 'space.user.checkIn',
  SPACE_LIKE = 'space.user.like',
  SPACE_SUPER_LIKE = 'space.user.superLike',
  SPACE_DISLIKE = 'space.user.dislike',
  SPACE_SUPER_DISLIKE = 'space.user.superDislike',

  // MARKETING
  SPACE_UNCLAIMED_EMAIL_SENT = 'space.marketing.unclaimedEmailSent',

  // USER
  USER_CONTENT_PREF_CAT_PREFIX = 'user.content.preferences.categories.',

  // FUNNEL — onboarding & viral-loop instrumentation. Dimensions carry
  // brandVariation and (where relevant) acquisition source so per-brand
  // conversion and viral coefficient can be computed from userMetrics alone.
  FUNNEL_USER_REGISTERED = 'funnel.user.registered',
  FUNNEL_USER_VERIFIED = 'funnel.user.verified',
  FUNNEL_USER_FIRST_LOGIN = 'funnel.user.firstLogin',
  FUNNEL_INVITE_SENT = 'funnel.invite.sent',
  FUNNEL_INVITE_ACCEPTED = 'funnel.invite.accepted',
  FUNNEL_PACT_CREATED = 'funnel.pact.created',
  FUNNEL_PACT_INVITE_SENT = 'funnel.pact.inviteSent',
  FUNNEL_PACT_INVITE_ACCEPTED = 'funnel.pact.inviteAccepted',
  FUNNEL_HABIT_CHECKIN = 'funnel.habit.checkin'
}

export default MetricNames;
