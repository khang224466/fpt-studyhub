import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const licenseKey = searchParams.get('key') || 'TRIAL-EDUNEXT-2H-AUTO';
  const origin = req.nextUrl.origin;

  const userScriptContent = `// ==UserScript==
// @name         FPT EduNext Study Assistant v10.1.2 (Cloud AI Proxy & Encrypted Trial Guard)
// @namespace    http://tampermonkey.net/
// @version      10.1.2
// @description  Study Assistant v10.1.2: Cloud AI Proxy mã hóa toàn bộ API Key, chống 429 Rate Limit bằng 25s backoff, tự động xử lý Làm Rõ Ý Định, khóa nộp 1 lần duy nhất | FPT Study Hub
// @author       FPT Study Hub & FD Team
// @match        *://fsc-edunext.fpt.edu.vn/*
// @match        *://*.fpt.edu.vn/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      *
// ==/UserScript==

(function() {
  'use strict';
  const SCRIPT_URL = ${JSON.stringify(origin + '/inject.js?key=' + licenseKey + '&tm=1')};
  
  function injectLoader() {
    if (document.getElementById('edunext-pro-hud')) return;
    const s = document.createElement('script');
    s.src = SCRIPT_URL + '&t=' + Date.now();
    s.async = true;
    (document.head || document.documentElement).appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLoader);
  } else {
    injectLoader();
  }
})();
`;

  return new NextResponse(userScriptContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Disposition': 'inline; filename="FPT_EduNext_Assistant_v10.1.2.user.js"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
