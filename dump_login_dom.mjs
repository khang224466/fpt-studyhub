import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const html = await page.evaluate(() => {
    const card = document.querySelector('.login-form, .login-box, .lg__content, .lg-container, [class*="login"], [class*="lg"]');
    return card ? card.innerHTML : document.body.innerHTML;
  });

  console.log("HTML length:", html.length);
  // Write to file
  import('fs').then(fs => {
    fs.writeFileSync('d:\\BUISINESS\\login_dom.html', html);
    console.log("Saved login_dom.html");
  });

  await browser.close();
}
run();
