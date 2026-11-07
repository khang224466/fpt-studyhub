import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();

  console.log("1. Navigating to login...");
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log("2. Clicking FEID...");
  await page.click('.lg-feid__button');
  await page.waitForTimeout(4000);

  console.log("3. Trying username without @gmail.com: 'khangdtfct32058'...");
  await page.fill('#Username', 'khangdtfct32058');
  await page.fill('#Password', 'TF9TobjK7qVhidFRWtLHoAnBP5HYuzvP7Q');

  console.log("4. Submitting...");
  await page.click('button[value="login"]');
  await page.waitForTimeout(6000);

  console.log("URL after submit:", page.url());
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- Body Text ---");
  console.log(bodyText);
  console.log("--- End Body Text ---");

  await browser.close();
}
run().catch(console.error);
