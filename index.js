const puppeteer = require('puppeteer');
const {parseISO, compareAsc, isBefore, format} = require('date-fns')
require('dotenv').config();

const {delay, sendEmail, logStep} = require('./utils');
const {siteInfo, loginCred, IS_PROD, NEXT_SCHEDULE_POLL, USE_MAILGUN, USE_TWILIO, MAX_NUMBER_OF_POLL, NOTIFY_ON_DATE_BEFORE, twilio} = require('./config');

let isLoggedIn_mainAccnt = false;
let isLoggedIn_checkAccnt = new Array(loginCred.EMAIL_CHECK.length).fill(false);;
let isScheduled = false;
let maxTries = MAX_NUMBER_OF_POLL;
let runFlag = true;
let twilio_client;
if (USE_TWILIO)
{  
  const Twilio = require('twilio');
  twilio_client = new Twilio(twilio.ACCOUNT_SID, twilio.AUTH_TOKEN);
}

const login = async (page, login_email, login_password, msg) => {
  try {
    logStep(msg+' logging in');
    await page.goto(siteInfo.LOGIN_URL);

    const form = await page.$("form#sign_in_form");

    const email = await form.$('input[name="user[email]"]');
    const password = await form.$('input[name="user[password]"]');
    const privacyTerms = await form.$('input[name="policy_confirmed"]');
    const signInButton = await form.$('input[name="commit"]');

    await email.type(login_email);
    await password.type(login_password);
    await privacyTerms.click();
    await signInButton.click();

    await page.waitForNavigation();

    console.log(msg+' login success');
    return true;
  } catch (error) {
    console.error('Errors during logging in:', error);
    return false;
  }
}

async function getTime(page, date, facility_id) {

  try {
    const timeUrl = siteInfo.APPOINTMENT_TIME_URL(facility_id, date);

    await page.goto(timeUrl);

    const content = await page.evaluate(() => document.querySelector('pre').innerText);
    const data = JSON.parse(content);
    const time = data.available_times[data.available_times.length - 1];

    return time;
  } catch (error) {
    console.error('Error while getting time:', error);
    throw error;
  }
}

async function reschedule(page, date, facility_id) {
  let success = false;
  logStep(`Starting Reschedule (${date})`);

  const appointment_time = await getTime(page, date, facility_id);

  try {
    await page.goto(siteInfo.APPOINTMENT_URL);

    const formData = {
      "utf8": "✓",
      "authenticity_token": await page.$eval('input[name="authenticity_token"]', el => el.value),
      "confirmed_limit_message": await page.$eval('input[name="confirmed_limit_message"]', el => el.value),
      "use_consulate_appointment_capacity": await page.$eval('input[name="use_consulate_appointment_capacity"]', el => el.value),
      "appointments[consulate_appointment][facility_id]": facility_id,
      "appointments[consulate_appointment][date]": date,
      "appointments[consulate_appointment][time]": appointment_time,
    };

    const response = await page.evaluate(async (formData) => {
      const form = document.createElement('form');
      form.method = 'POST';

      for (const key in formData) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = formData[key];
        form.appendChild(input);
      }

      document.body.appendChild(form);
      return fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
      });
    }, formData);
    console.log(response);
    const text = await response.text();
    if (text.includes('Successfully Scheduled')) {
      const msg = `Rescheduled Successfully! ${date} ${time}`;
      console.log(msg);
      success = true;
    } else {
      const msg = `Reschedule Failed. ${date} ${time}`;
      console.log(msg);
    }
  } catch (error) {
    console.error('Error during reschedule:', error);
  } finally {
    return success;
  }
}



const notifyMe = async (earliestDate, city_name) => {
  logStep(`sending a notification to schedule for ${earliestDate}`);

  if(USE_MAILGUN)
  {
    await sendEmail({
      subject: `We found an earlier date ${earliestDate} for ${city_name}`,
      text: `Hurry and schedule for ${earliestDate} before it is taken.`
    }); 
}
  if(USE_TWILIO)
  {
    for(const index in twilio.PHONE_NUMBERS) {
      await twilio_client.messages.create({
        body: `We found an earlier date ${earliestDate} for ${city_name}. Hurry and schedule before it is taken.`,
        to: twilio.PHONE_NUMBERS[index],  
        from: twilio.VIRTUAL_PHONE
      });
    }
  }
}

const checkSchedules_1 = async (page) => {
  try{
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    });

    const appointments_url = siteInfo.APPOINTMENTS_JSON_URLS;
    const currentTime = format(new Date(), 'HH:mm');


    for (let i=0; i<appointments_url.length; i++) {
      const city_name = siteInfo.FACILITY_NAME[i];
      logStep('['+currentTime+'] checking for schedules for ' + city_name);
      await page.goto(appointments_url[i]);

      const bodyText = await page.evaluate(() => document.querySelector('body').innerText);
      console.log(bodyText);

      const parsedBody =  JSON.parse(bodyText);

      if(!Array.isArray(parsedBody)) {
        throw "Failed to parse dates, probably because you are not logged in";
      }

      const dates =parsedBody.map(item => parseISO(item.date));
      const [early_date] = dates.sort(compareAsc);

      if (early_date && isBefore(early_date, parseISO(NOTIFY_ON_DATE_BEFORE))) {
        const earliestDate = format(early_date, 'yyyy-MM-dd');
        isScheduled = reschedule(page, earliestDate, siteInfo.FACILITY_ID[i]);
        await notifyMe(earliestDate, city_name);
        break;
      }

    }
    return true;
  }catch(err){
    console.log("Unable to parse page JSON content", err);
    return false;
  }

}


const checkSchedules_2 = async (page, url, mainPage) => {
  try{
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    });
    const currentTime = format(new Date(), 'HH:mm');
    await page.goto(url);

    const bodyText =  await page.evaluate(() => document.querySelector('body').innerText);

    const referenceDate = new Date(NOTIFY_ON_DATE_BEFORE);
    const lines = bodyText.split('\n');
    const cities = siteInfo.FACILITY_NAME;
    let flag = false;
    for (let line of lines) {
        for (const i in cities) {
          const city = cities[i];
          if (line.startsWith(city)) {
            flag = true;
            const dateStr = line.split('\t')[1];
            console.log('['+ currentTime + '] ' + city+': '+ dateStr);
            if(dateStr !== "No Appointments Available") {
              const date = new Date(dateStr);
              if(date < referenceDate) {
                isScheduled = reschedule(mainPage, format(date, 'yyyy-MM-dd'), siteInfo.FACILITY_ID[i]);
                await notifyMe(dateStr, city);
              }
            
            }
              
          }
        }
    }
    return flag;
    
  }catch(err){
    console.log("Unable to parse page JSON content", err);
    return false;
  }

}



const process = async (mainBrowser, checkBrowser) => {
  let mainPage, checkPage = []; 
  try {
    mainPage = await Promise.race([
      mainBrowser.newPage(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60000))
    ]);
    for(let i in checkBrowser) {
      checkPage[i] = await Promise.race([
        checkBrowser[i].newPage(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 60000))
      ]);

    }
    
  } catch (error) {
    console.log('New page creation timed out, retrying...');
  }
  while (maxTries > 0) {
    if(isScheduled) {
      break;
    }
    logStep(`starting process with ${maxTries} tries left`);
    while (!isLoggedIn_mainAccnt) {
      isLoggedIn_mainAccnt = await login(mainPage, loginCred.EMAIL, loginCred.PASSWORD, "main account");
    }
    for(let i in checkPage) {
      while (!isLoggedIn_checkAccnt[i]) {
        isLoggedIn_checkAccnt[i] = await login(checkPage[i], loginCred.EMAIL_CHECK[i], loginCred.PASSWORD_CHECK[i], "check account "+i);
      }
    }
    

    if(runFlag) {
      isLoggedIn_mainAccnt = await checkSchedules_1(mainPage);
      if(isLoggedIn_mainAccnt) 
      {
        runFlag = false;
        await delay(NEXT_SCHEDULE_POLL);
      }
    } else{
      for(let i in checkPage) {
        isLoggedIn_checkAccnt[i] = await checkSchedules_2(checkPage[i], siteInfo.PAYMENT_URL[i], mainPage);
        if(isLoggedIn_checkAccnt[i]) 
        {
          runFlag = true;
          await delay(NEXT_SCHEDULE_POLL);
        }
      }
      
    }
    --maxTries;  
  }

  console.log('Reached Max tries');
};



(async () => {
  const mainBrowser = await puppeteer.launch(!IS_PROD ? {headless: false}: undefined);
  let checkBrowser = [];
  for(let i in siteInfo.SCHEDULE_ID_CHECK) {
    checkBrowser[i] = await puppeteer.launch(!IS_PROD ? {headless: false}: undefined);
  }

  try{
    await process(mainBrowser, checkBrowser);
  }catch(err){
    console.error(err);
  }

  await mainBrowser.close();
  for(let i in siteInfo.SCHEDULE_ID_CHECK) {
    await checkBrowser[i].close();
  }

})();
