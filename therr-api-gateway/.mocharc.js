// Pin the suite to UTC.
//
// CI runs UTC and production runs UTC, so a test that reads the host timezone
// passes here and fails only on a developer's machine — and, west of UTC, only
// after local evening, which reads as flakiness rather than as the real defect.
// Two such bugs shipped into the habits lifecycle work (a date parsed at UTC
// midnight then formatted as a local calendar date, in both the engine and its
// fixtures) and neither was visible to CI.
//
// This makes the default deterministic; it does not remove timezone coverage.
// Tests that care set `process.env.TZ` themselves and assert across several
// zones — see "the trailing windows" in
// users-service/tests/unit/handlers-habits-digest-lifecycle.test.ts.
process.env.TZ = 'UTC';

module.exports = {
  extension: ['ts', 'js'],
  require: ['./tests/setup.ts'],

  // Above mocha's 2000ms default, because two integration tests deliberately
  // outlast a Redis TTL before asserting it expired:
  //   tests/integration/authentication.test.ts  "should expire session tokens after TTL"
  //   tests/integration/serviceRouting.test.ts  "should reset rate limit after window expires"
  // Both sleep 2500ms, so at the default they can only pass while Redis is
  // *absent* and they skip — the moment infrastructure is up they fail on
  // timeout. That made `.husky/pre-push` unpassable either way (Redis down
  // failed the push-notifications teardown; Redis up failed these two), which
  // is how `--no-verify` became routine.
  //
  // Deliberately not so generous that a genuinely hung test stalls CI rather
  // than failing: the real waits here are ~2.5s.
  timeout: 10000,
};

