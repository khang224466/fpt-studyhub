import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  console.log("Current URL before click:", page.url());

  page.on('request', r => console.log("[NAV REQ]", r.url()));

  // Click FEID button
  const feidBtn = await page.$('.lg-feid__button');
  if (feidBtn) {
    console.log("Clicking FEID button...");
    await feidBtn.click();
    await page.waitForTimeout(5000);
    console.log("Current URL after click:", page.url());
    console.log("Title after click:", await page.title());
    await page.screenshot({ path: 'd:\\BUISINESS\\feid_nav.png', fullPage: true });
    console.log("Saved feid_nav.png");
  } else {
    console.log("FEID button not found!");
  }

  await browser.close();
}
run();
