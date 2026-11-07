import { chromium } from 'playwright-core';

async function run() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Look for any elements containing 'tài khoản' or clickable elements
  const details = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all
      .filter(el => (el.innerText || '').includes('hoặc đăng nhập bằng tài khoản') && el.children.length === 0)
      .map(el => ({
        tag: el.tagName,
        text: el.innerText,
        className: el.className,
        parentTag: el.parentElement ? el.parentElement.tagName : null,
        parentClass: el.parentElement ? el.parentElement.className : null
      }));
  });
  console.log("Found matches:", details);

  // Click on "hoặc đăng nhập bằng tài khoản" if exists
  const clicked = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(e => (e.innerText || '').trim() === 'hoặc đăng nhập bằng tài khoản');
    if (el) {
      el.click();
      return true;
    }
    return false;
  });
  console.log("Clicked:", clicked);

  await page.waitForTimeout(2000);

  // Check inputs again
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      id: i.id,
      className: i.className
    }));
  });
  console.log("Inputs after click:", inputs);

  await page.screenshot({ path: 'd:\\BUISINESS\\edunext_login_clicked.png' });

  await browser.close();
}
run();
