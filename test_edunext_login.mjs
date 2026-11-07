import { chromium } from 'playwright-core';

async function run() {
  console.log("Launching Edge browser to inspect /login ...");
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
  });
  
  const page = await context.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('login') || req.url().includes('auth')) {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/') || res.url().includes('login') || res.url().includes('auth')) {
      console.log(`[RES] ${res.status()} ${res.url()}`);
    }
  });
  
  console.log("Navigating to https://fsc-edunext.fpt.edu.vn/login ...");
  await page.goto('https://fsc-edunext.fpt.edu.vn/login', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  console.log("Current URL:", page.url());
  console.log("Title:", await page.title());
  
  await page.screenshot({ path: 'd:\\BUISINESS\\edunext_login.png', fullPage: true });
  console.log("Saved screenshot to d:\\BUISINESS\\edunext_login.png");
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- Visible Body Text Preview ---");
  console.log(bodyText);
  console.log("--- End Text Preview ---\n");
  
  const elements = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('button, a, input, [role="button"], select').forEach(el => {
      items.push({
        tag: el.tagName,
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: el.placeholder || '',
        text: (el.innerText || el.value || '').trim().slice(0, 50),
        className: el.className || '',
        href: el.href || ''
      });
    });
    return items;
  });
  
  console.log("Interactive elements count:", elements.length);
  console.log("Interactive elements:", JSON.stringify(elements, null, 2));
  
  await browser.close();
}

run().catch(err => console.error("Script error:", err));
