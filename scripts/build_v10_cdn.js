const fs = require('fs');
const path = require('path');

const routeContent = fs.readFileSync(path.join(__dirname, '../src/app/inject.js/route.ts'), 'utf8');
const startMarker = 'const minifiedCode = "';
const startIdx = routeContent.indexOf(startMarker);
if (startIdx === -1) {
  console.error('Could not find startMarker');
  process.exit(1);
}

const codeStart = startIdx + startMarker.length;
const endIdx = routeContent.indexOf('";\n  const scriptContent', codeStart);
if (endIdx === -1) {
  console.error('Could not find endIdx');
  process.exit(1);
}

const rawMinified = routeContent.slice(codeStart, endIdx);
// Unescape the string literal
const minifiedCode = JSON.parse('"' + rawMinified + '"');
console.log('Successfully extracted minifiedCode, length:', minifiedCode.length);

const finalScript = `/**
 * EduNext AI Assistant Pro v10.2.50 (Auto-Solve & 35s Countdown Timer)
 * Delivered via jsDelivr CDN — Whitelisted by FPT EduNext CSP & TrustedTypes
 */
(function() {
  'use strict';
  var key = window.__ENX_KEY__ || '';
  if (!key) {
    try {
      key = localStorage.getItem('enx_encrypted_ai_key') || localStorage.getItem('enx_license_key') || '';
    } catch(_) {}
  }
  try {
    ;(${minifiedCode})(key);
  } catch(e) {
    alert('Lỗi khởi động EduNext AI Pro: ' + (e.message || e));
  }
})();
`;

const outputPath = path.join(__dirname, '../../v10_2_50_minified.js');
fs.writeFileSync(outputPath, finalScript, 'utf8');
console.log('Saved to', outputPath, 'size:', finalScript.length);
