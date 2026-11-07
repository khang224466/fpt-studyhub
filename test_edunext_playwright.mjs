import { chromium } from 'playwright-core';
import fs from 'fs';

async function run() {
  console.log("Launching Edge browser via Playwright-core...");
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
  });
  
  const page = await context.newPage();
  
  // Listen to network requests
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('login') || req.url().includes('auth')) {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/') || res.url().includes('login') || res.url().includes('auth')) {
      console.log(`[RES] ${res.status()} ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`[RES BODY] ${text.slice(0, 200)}`);
      } catch (_) {}
    }
  });
  
  console.log("Navigating to https://fsc-edunext.fpt.edu.vn/home ...");
  try {
    await page.goto('https://fsc-edunext.fpt.edu.vn/home', { waitUntil: 'load', timeout: 30000 });
  } catch (e) {
    console.log("Navigation finished with note:", e.message);
  }
  
  // Wait 4 seconds for React to mount
  await page.waitForTimeout(4000);
  
  const currentUrl = page.url();
  const title = await page.title();
  console.log("Current URL:", currentUrl);
  console.log("Title:", title);
  
  // Save screenshot
  const screenshotPath = 'd:\\BUISINESS\\edunext_landing.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${screenshotPath}`);
  
  // Dump text content
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("\n--- Visible Body Text Preview ---");
  console.log(bodyText.slice(0, 1000));
  console.log("--- End Text Preview ---\n");
  
  // Inspect interactive elements
  const elements = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
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
  console.log("Interactive elements sample:", JSON.stringify(elements.slice(0, 25), null, 2));

  // Check if there is a login modal, login button, or email/password inputs
  const inputs = await page.$$('input');
  console.log("Input elements count:", inputs.length);
  for (let i = 0; i < inputs.length; i++) {
    const inputType = await inputs[i].getAttribute('type');
    const inputName = await inputs[i].getAttribute('name');
    const inputPlaceholder = await inputs[i].getAttribute('placeholder');
    console.log(`Input ${i}: type="${inputType}" name="${inputName}" placeholder="${inputPlaceholder}"`);
  }
  
  await browser.close();
}

run().catch(err => console.error("Script error:", err));
