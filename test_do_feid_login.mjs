import { chromium } from 'playwright-core';

async function run() {
  console.log("Launching Edge to test FEID login...");
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
  });
  const page = await context.newPage();

  page.on('request', r => {
    if (r.url().includes('feid') || r.url().includes('edunext') || r.url().includes('login') || r.url().includes('callback')) {
      console.log(`[REQ] ${r.method()} ${r.url().slice(0, 120)}`);
    }
  });

  page.on('response', res => {
    if (res.url().includes('feid') || res.url().includes('edunext') || res.url().includes('login') || res.url().includes('callback')) {
      console.log(`[RES] ${res.status()} ${res.url().slice(0, 120)}`);
    }
  });

  console.log("1. Going to https://fsc-edunext.fpt.edu.vn/login ...");
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log("2. Clicking FEID button...");
  await page.click('.lg-feid__button');
  await page.waitForNavigation({ waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log("3. On FEID login page:", page.url());

  console.log("4. Filling Username and Password...");
  await page.fill('#Username', 'khangdtfct32058@gmail.com');
  await page.fill('#Password', 'TF9TobjK7qVhidFRWtLHoAnBP5HYuzvP7Q');

  await page.screenshot({ path: 'd:\\BUISINESS\\feid_filled.png' });
  console.log("Saved feid_filled.png");

  console.log("5. Submitting login form...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log("Navigation note:", e.message)),
    page.click('button[type="submit"]')
  ]);

  await page.waitForTimeout(5000);

  console.log("6. URL after login attempt:", page.url());
  console.log("Title after login attempt:", await page.title());

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- Page Body Text After Login ---");
  console.log(bodyText.slice(0, 1500));
  console.log("--- End Page Body Text ---\n");

  await page.screenshot({ path: 'd:\\BUISINESS\\feid_after_submit.png', fullPage: true });
  console.log("Saved feid_after_submit.png");

  // Check cookies / localStorage
  const cookies = await context.cookies();
  console.log(`Cookies count: ${cookies.length}`);
  for (const c of cookies) {
    console.log(`  Cookie: ${c.name} (${c.domain})`);
  }

  await browser.close();
}
run().catch(err => console.error("Error:", err));
