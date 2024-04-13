module.exports = {
  loginCred:{
    EMAIL: process.env.EMAIL,
    PASSWORD: process.env.PASSWORD,
    EMAIL_CHECK: process.env.EMAIL_CHECK.split(','),
    PASSWORD_CHECK: process.env.PASSWORD_CHECK.split(',')
  },

  siteInfo: {
    COUNTRY_CODE: process.env.COUNTRY_CODE || 'en-ca',
    SCHEDULE_ID: process.env.SCHEDULE_ID,
    SCHEDULE_ID_CHECK: process.env.SCHEDULE_ID_CHECK.split(','),
    FACILITY_ID: process.env.FACILITY_ID.split(','),
    FACILITY_NAME: process.env.FACILITY_NAME.split(','),

    get APPOINTMENTS_JSON_URLS(){
      return this.FACILITY_ID.map(id => `https://ais.usvisa-info.com/${this.COUNTRY_CODE}/niv/schedule/${this.SCHEDULE_ID}/appointment/days/${id}.json?appointments%5Bexpedite%5D=false`);
    },

    get PAYMENT_URL(){
      return this.SCHEDULE_ID_CHECK.map(id => `https://ais.usvisa-info.com/${this.COUNTRY_CODE}/niv/schedule/${id}/payment`);
    },

    get LOGIN_URL () {
      return `https://ais.usvisa-info.com/${this.COUNTRY_CODE}/niv/users/sign_in`
    },

    get APPOINTMENT_URL () {
      return `https://ais.usvisa-info.com/${this.COUNTRY_CODE}/niv/schedule/${this.SCHEDULE_ID}/appointment`
    },

    APPOINTMENT_TIME_URL(facility_id, date) {
      return `https://ais.usvisa-info.com/${this.COUNTRY_CODE}/niv/schedule/${this.SCHEDULE_ID}/appointment/times/${facility_id}.json?date=${date}&appointments[expedite]=false`;
    }
  },
  IS_PROD: process.env.NODE_ENV === 'prod',
  NEXT_SCHEDULE_POLL: process.env.NEXT_SCHEDULE_POLL || 30_000, // default to 30 seconds
  MAX_NUMBER_OF_POLL: process.env.MAX_NUMBER_OF_POLL || 250, // number of polls before stopping
  NOTIFY_ON_DATE_BEFORE: process.env.NOTIFY_ON_DATE_BEFORE, // in ISO format i.e YYYY-MM-DD
  USE_MAILGUN: process.env.USE_MAILGUN === 'true',
  USE_TWILIO: process.env.USE_TWILIO === 'true',


  NOTIFY_EMAILS: process.env.NOTIFY_EMAILS, // comma separated list of emails
  mailgun: {
    USERNAME: process.env.MAILGUN_USERNAME,
    DOMAIN: process.env.MAILGUN_DOMAIN,
    API_KEY: process.env.MAILGUN_API_KEY,
  },
  twilio: {
    PHONE_NUMBERS: process.env.PHONE_NUMBERS.split(','),
    VIRTUAL_PHONE: process.env.TWILIO_PHONE_NUMBER,
    ACCOUNT_SID: process.env.TWILIO_ACCOUNTSID,
    AUTH_TOKEN: process.env.TWILIO_TOKEN,
  }
}
