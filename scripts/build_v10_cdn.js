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
 * EduNext AI Assistant Pro v10.2.62 PRO (Self-Healing Key & Instant Direct Flash-Lite / Bridge)
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
  if (!key) {
    key = 'ENC_AI_MDAxNjA4MjM2MjdkNzM2YjA1MDcwMzA3NmM3NDc1NzY2MzM0NmU2YzAyMmQ2NTBkMjEzYjdmN2I3MTYzMGI1YTUxNWM1MTc2M2EwZDEwN2QwOTNkNzQxYjFhNzMwYzdlMmIyNzJhMjI3YjFhNDU1ODQ0NzUxNTJmM2YyNjYxMGYzMTBkMWYxMDc0MDI3YzA5MGYxZjcwMzUwNzYxNGE1NjRmM2IzYzM4Mjk3ZTcxM2EzYzJl';
  }
  try {
    ;(${minifiedCode})(key);
  } catch(e) {
    alert('Lỗi khởi động EduNext AI Pro: ' + (e.message || e));
  }
})();
`;

// List of all versions to keep backward compatibility 100%
const versions = [
  '62', '61', '60', '59', '58', '57', '56', '55', '54', '53', '52', '51', '50',
  '30', '29', '28', '27', '26', '25', '24', '23', '22', '21', '20',
  '19', '18', '17', '16'
];

versions.forEach(v => {
  const targetPath = path.join(__dirname, `../../v10_2_${v}_minified.js`);
  fs.writeFileSync(targetPath, finalScript, 'utf8');
  console.log(`Saved to v10_2_${v}_minified.js (${finalScript.length} bytes)`);
});

console.log('All CDN files updated successfully.');
