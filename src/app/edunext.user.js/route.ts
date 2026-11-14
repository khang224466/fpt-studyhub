import { NextRequest, NextResponse } from 'next/server';
import { EDUNEXT_SOURCE, EDUNEXT_VERSION } from '@/lib/edunextBundle';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') || '';
  
  const userScript = `// ==UserScript==
// @name         EduNext AI Assistant Pro (Bypass Cloudflare & Auto-Solve)
// @namespace    https://fpt-studyhub.vercel.app/
// @version      ${EDUNEXT_VERSION}
// @description  Hỗ trợ sinh viên FPT giải bài tập EduNext tự động, chụp ảnh Vision qua Google Gemini Flash, không spam, học theo gợi ý giáo viên, auto liên tục cho đến khi hoàn thành.
// @author       FPT Study Hub
// @match        *://fu-edunext.fpt.edu.vn/*
// @match        *://fsc-edunext.fpt.edu.vn/*
// @match        *://edunext.fpt.edu.vn/*
// @icon         https://fpt-studyhub.vercel.app/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      generativelanguage.googleapis.com
// @connect      fpt-studyhub.vercel.app
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    try {
        if (typeof GM_xmlhttpRequest === 'function') {
            window.__ENX_GM_XHR__ = GM_xmlhttpRequest;
            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.__ENX_GM_XHR__ = GM_xmlhttpRequest;
            }
        }
    } catch(e) {}
    
    ;(${EDUNEXT_SOURCE})(${JSON.stringify(key)});
})();`;

  return new NextResponse(userScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}
