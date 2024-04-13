# US-visa-appointment-notifier
The project is based on [this](https://github.com/theoomoregbee/US-visa-appointment-notifier).

This is just a script I put together to check and notify me via email ([MailGun](https://www.mailgun.com/)) and via phone texts (Twilio) when there's an earlier date before my initial appointment date. You can also schedule and reschedule your appointment.

By now only Canada us-visa website is tested.


```
$ npm start
=====>>> Step: starting process with 250 tries left
=====>>> Step: logging in
=====>>> Step: [20:36] checking for schedules for Ottawa
[]
=====>>> Step: [20:36] checking for schedules for Quebec City
[]
=====>>> Step: starting process with 4999 tries left
[20:37] Ottawa: No Appointments Available
[20:37] Quebec City: No Appointments Available
[20:38] Ottawa: No Appointments Available
[20:38] Quebec City: No Appointments Available
...
```

![email notification sample](./email-screen-shot.png)


## How it works

* Prepare a main account (the account you wish to make an appointment) and some check accounts (mainly used to check available times).
* Logs you into the portal
* checks for schedules by day 
* If there's a date before your initial appointment, it notifies you via email and phone texts (if you have a Twilio account).
* If no dates found, the process waits for set amount of seconds to cool down before restarting and will stop when it reaches the set max retries.

> see `.env` for values you can configure

## Configuration

Modify `.env` and replace the values.

### MailGun config values 

You can create a free account with https://www.mailgun.com/ which should be sufficient and use the provided sandbox domain on your dashboard. The `MAILGUN_API_KEY` can be found in your Mailgun dashboard, it starts with `key-xxxxxx`. You'll need to add authorised recipients to your sandbox domain for free accounts


## FAQ

* How do I get my facility ID - https://github.com/theoomoregbee/US-visa-appointment-notifier/issues/3
* How do I get my schedule ID - https://github.com/theoomoregbee/US-visa-appointment-notifier/issues/8, https://github.com/theoomoregbee/US-visa-appointment-notifier/issues/7#issuecomment-1372565292
* How to setup Mailgun Authorised recipients - https://github.com/theoomoregbee/US-visa-appointment-notifier/issues/5

## How to use it

* clone the repo 
* run `npm i` within the cloned repo directory
* start the process with `npm start`


