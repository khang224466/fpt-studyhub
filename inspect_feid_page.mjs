import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Click FEID
  await page.click('.lg-feid__button');
  await page.waitForNavigation({ waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log("FEID Page URL:", page.url());
  console.log("FEID Page Title:", await page.title());

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- FEID Body Text ---");
  console.log(bodyText);
  console.log("--- End FEID Body Text ---\n");

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, button, select, a')).map(el => ({
      tag: el.tagName,
      type: el.type || '',
      name: el.name || '',
      id: el.id || '',
      placeholder: el.placeholder || '',
      value: el.value || '',
      text: (el.innerText || '').trim().slice(0, 40)
    }));
  });
  console.log("FEID elements:", JSON.stringify(inputs, null, 2));

  await browser.close();
}
run();
