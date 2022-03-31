import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''; // Your Account SID from www.twilio.com/console
const authToken = process.env.TWILIO_AUTH_TOKEN || ''; // Your Auth Token from www.twilio.com/console

const client = new twilio.Twilio(accountSid, authToken);

export default client;
