import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));

  console.log("1. Navigating to login...");
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log("2. Clicking FEID...");
  await page.click('.lg-feid__button');
  await page.waitForTimeout(4000);

  console.log("Current URL:", page.url());

  // Inspect form and button selector
  const btnInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[value="login"]') || document.querySelector('button[type="submit"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Login'));
    return btn ? {
      tag: btn.tagName,
      type: btn.type,
      name: btn.name,
      value: btn.value,
      text: btn.innerText,
      visible: btn.offsetParent !== null,
      outerHTML: btn.outerHTML
    } : null;
  });
  console.log("Button info:", btnInfo);

  // Check if there is a captcha on feid.fpt.edu.vn
  const captchaInfo = await page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.src);
    return {
      recaptcha: iframes.filter(s => s.includes('recaptcha')),
      text: document.body.innerText
    };
  });
  console.log("Captcha iframes on FEID:", captchaInfo.recaptcha);

  // Fill credentials
  await page.fill('#Username', 'khangdtfct32058@gmail.com');
  await page.fill('#Password', 'TF9TobjK7qVhidFRWtLHoAnBP5HYuzvP7Q');
  
  // Submit via clicking button or form.submit()
  console.log("Clicking button...");
  const submitted = await page.evaluate(() => {
    const btn = document.querySelector('button[value="login"]') || document.querySelector('button[type="submit"]');
    if (btn) {
      btn.click();
      return 'clicked_btn';
    }
    const form = document.querySelector('form');
    if (form) {
      form.submit();
      return 'submitted_form';
    }
    return 'none';
  });
  console.log("Submission method:", submitted);

  // Wait 6 seconds for response
  await page.waitForTimeout(6000);

  console.log("After submit URL:", page.url());
  console.log("After submit Title:", await page.title());
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- Body Text After Submit ---");
  console.log(bodyText);
  console.log("--- End Body Text ---");

  await page.screenshot({ path: 'd:\\BUISINESS\\feid_after_submit_result.png', fullPage: true });

  await browser.close();
}
run().catch(console.error);
