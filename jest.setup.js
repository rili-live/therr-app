// Bridge Mocha-style globals to Jest equivalents
// Some service tests were written for Mocha and use `before`/`after` instead of `beforeAll`/`afterAll`
global.before = global.beforeAll;
global.after = global.afterAll;
