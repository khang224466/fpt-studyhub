const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../src/lib/edunextBundle.ts');
const bundleContent = fs.readFileSync(bundlePath, 'utf8');
const startMarker = 'export const EDUNEXT_SOURCE = ';
const startIdx = bundleContent.indexOf(startMarker);
if (startIdx === -1) {
  console.error('Could not find startMarker in edunextBundle.ts');
  process.exit(1);
}

const codeStart = startIdx + startMarker.length;
const rawCode = bundleContent.slice(codeStart).trim().replace(/;$/, '');
const minifiedCode = JSON.parse(rawCode);
console.log('Successfully extracted minifiedCode from edunextBundle.ts, length:', minifiedCode.length);

const finalScript = `/**
 * EduNext AI Assistant Pro v10.2.54 (English Ready/Yes Support & 7 Sessions/Week Quota)
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

// 1. Target v10.2.54
const outputPath54 = path.join(__dirname, '../../v10_2_54_minified.js');
fs.writeFileSync(outputPath54, finalScript, 'utf8');
console.log('Saved to', outputPath54, 'size:', finalScript.length);

// 2. Backward compatibility for earlier links
const outputPath53 = path.join(__dirname, '../../v10_2_53_minified.js');
fs.writeFileSync(outputPath53, finalScript, 'utf8');
console.log('Saved to', outputPath53, 'size:', finalScript.length);

const outputPath52 = path.join(__dirname, '../../v10_2_52_minified.js');
fs.writeFileSync(outputPath52, finalScript, 'utf8');
console.log('Saved to', outputPath52, 'size:', finalScript.length);

const outputPath51 = path.join(__dirname, '../../v10_2_51_minified.js');
fs.writeFileSync(outputPath51, finalScript, 'utf8');
console.log('Saved to', outputPath51, 'size:', finalScript.length);

const outputPath50 = path.join(__dirname, '../../v10_2_50_minified.js');
fs.writeFileSync(outputPath50, finalScript, 'utf8');
console.log('Saved to', outputPath50, 'size:', finalScript.length);
