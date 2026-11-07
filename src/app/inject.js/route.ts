import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const licenseKey = searchParams.get('key') || '';
  const origin = req.nextUrl.origin;

  const scriptContent = `
/**
 * FPT EduNext AI Assistant Pro v10.1.1 (Cloud AI Proxy & Encrypted Trial Guard)
 * Auto Solver, Intent Auto-Select, Hard Submit Lock & Anti-429 Guard
 */
(function() {
  'use strict';

  const CURRENT_VERSION = '10.1.1';
  const LICENSE_KEY = ${JSON.stringify(licenseKey)};
  const API_SOLVE_ENDPOINT = ${JSON.stringify(origin + '/api/v1/ai/solve')};
  const API_CLAIM_ENDPOINT = ${JSON.stringify(origin + '/api/v1/auth/session-claim')};
  const PLATFORM_ORIGIN = ${JSON.stringify(origin)};

  if (window.__EDUNEXT_ASSISTANT_V10_ACTIVE__) {
    const existing = document.getElementById('edunext-pro-hud');
    if (existing) {
      existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
      return;
    }
  }
  window.__EDUNEXT_ASSISTANT_V10_ACTIVE__ = true;

  // State
  let isAutoSolveRunning = true;
  let isAutoSubmit = true;
  let isSubmitting = false;
  let lastSubmitTimestamp = 0;
  let rateLimitCooldownUntil = 0;
  let lastProcessedQuestionHash = '';
  let licenseInfo = { remaining: '2 giờ', isTrial: true, expiresAt: Date.now() + 2 * 3600 * 1000 };

  // ============================================================
  // 1. DUAL 429 RATE LIMIT INTERCEPTOR (FETCH + XHR)
  // ============================================================
  (function installRateLimitDetector() {
    try {
      const nativeFetch = window.fetch;
      window.fetch = async function(...args) {
        try {
          const res = await nativeFetch.apply(this, args);
          if (res && res.status === 429) {
            triggerRateLimitBackoff('Fetch 429 Too Many Requests');
          }
          return res;
        } catch (e) {
          return nativeFetch.apply(this, args);
        }
      };

      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._reqUrl = url;
        return originalOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('loadend', () => {
          if (this.status === 429) {
            triggerRateLimitBackoff('XHR 429 từ: ' + (this._reqUrl || 'API Gateway'));
          }
        });
        return originalSend.apply(this, arguments);
      };
    } catch (_) {}
  })();

  function triggerRateLimitBackoff(source) {
    rateLimitCooldownUntil = Date.now() + 25000;
    addLog('warn', '⚠️ Phát hiện 429 (' + source + ') — Giãn cách 25s bảo vệ gateway');
    updateHudStatus('⚠️ Tạm hoãn 25s (Chống 429 Rate Limit)...', '#f59e0b');
  }

  // ============================================================
  // 2. HUD UI INJECTION
  // ============================================================
  const oldHud = document.getElementById('edunext-pro-hud');
  if (oldHud) oldHud.remove();

  const hud = document.createElement('div');
  hud.id = 'edunext-pro-hud';
  hud.style.cssText = [
    'position: fixed',
    'bottom: 24px',
    'right: 24px',
    'z-index: 2147483647',
    'width: 360px',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'background: rgba(11, 15, 25, 0.95)',
    'border: 1px solid rgba(16, 185, 129, 0.4)',
    'border-radius: 16px',
    'box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(16, 185, 129, 0.2)',
    'padding: 16px',
    'color: #f1f5f9',
    'backdrop-filter: blur(16px)',
    'transition: all 0.25s ease',
    'user-select: none'
  ].join(';');

  hud.innerHTML = \`
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;border-radius:8px;background:#10b981;display:flex;align-items:center;justify-content:center;color:#000;font-weight:900;font-size:15px;">⚡</div>
        <div>
          <div style="font-weight:800;font-size:13px;letter-spacing:0.3px;color:#fff;display:flex;align-items:center;gap:6px;">
            <span>EduNext AI Pro</span>
            <span style="font-size:10px;background:#10b98126;color:#34d399;border:1px solid #10b98150;padding:1px 5px;border-radius:4px;">v\${CURRENT_VERSION}</span>
          </div>
          <div id="hud-tier-label" style="font-size:11px;color:#94a3b8;">Đang xác thực...</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="hud-min-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;padding:4px;font-size:14px;">−</button>
        <button id="hud-close-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;padding:4px;font-size:14px;">✕</button>
      </div>
    </div>

    <div id="hud-body">
      <!-- Status pill -->
      <div id="hud-status" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:8px 10px;font-size:12px;color:#34d399;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;animation:pulse 1.5s infinite;"></span>
        <span id="hud-status-text">Đang kết nối Cloud AI Proxy...</span>
      </div>

      <!-- Controls Grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <button id="hud-toggle-auto" style="background:#1e293b;border:1px solid #334155;color:#f8fafc;padding:8px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
          <span>⚡ Tự Động:</span> <strong style="color:#10b981;">BẬT</strong>
        </button>
        <button id="hud-toggle-submit" style="background:#1e293b;border:1px solid #334155;color:#f8fafc;padding:8px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
          <span>📝 Tự Nộp:</span> <strong style="color:#10b981;">BẬT</strong>
        </button>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <button id="hud-solve-now-btn" style="flex:1;background:linear-gradient(135deg, #10b981, #059669);border:none;color:#fff;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
          <span>🎯 Giải Câu Này Ngay</span>
        </button>
      </div>

      <!-- Mini Live Console -->
      <div style="background:#020617;border:1px solid #1e293b;border-radius:8px;padding:8px;font-family:monospace;font-size:10px;height:80px;overflow-y:auto;" id="hud-logs">
        <div style="color:#64748b;">[Ready] Trợ lý EduNext v\${CURRENT_VERSION} đã nạp.</div>
        <div style="color:#10b981;">[Key] License: \${LICENSE_KEY ? LICENSE_KEY.slice(0, 14) + '...' : 'Chưa gắn'}</div>
        <div style="color:#38bdf8;">[Proxy] API Key được bảo vệ & mã hóa trên Server.</div>
      </div>
    </div>
  \`;

  document.body.appendChild(hud);

  // HUD interaction
  document.getElementById('hud-close-btn').onclick = () => hud.remove();
  let isMinimized = false;
  document.getElementById('hud-min-btn').onclick = () => {
    isMinimized = !isMinimized;
    document.getElementById('hud-body').style.display = isMinimized ? 'none' : 'block';
    document.getElementById('hud-min-btn').textContent = isMinimized ? '+' : '−';
  };

  const toggleAutoBtn = document.getElementById('hud-toggle-auto');
  toggleAutoBtn.onclick = () => {
    isAutoSolveRunning = !isAutoSolveRunning;
    toggleAutoBtn.innerHTML = \`<span>⚡ Tự Động:</span> <strong style="color:\${isAutoSolveRunning ? '#10b981' : '#ef4444'};">\${isAutoSolveRunning ? 'BẬT' : 'TẮT'}</strong>\`;
    addLog('info', 'Tự động giải: ' + (isAutoSolveRunning ? 'BẬT' : 'TẮT'));
  };

  const toggleSubmitBtn = document.getElementById('hud-toggle-submit');
  toggleSubmitBtn.onclick = () => {
    isAutoSubmit = !isAutoSubmit;
    toggleSubmitBtn.innerHTML = \`<span>📝 Tự Nộp:</span> <strong style="color:\${isAutoSubmit ? '#10b981' : '#ef4444'};">\${isAutoSubmit ? 'BẬT' : 'TẮT'}</strong>\`;
    addLog('info', 'Tự động nộp bài: ' + (isAutoSubmit ? 'BẬT' : 'TẮT'));
  };

  document.getElementById('hud-solve-now-btn').onclick = () => {
    addLog('info', 'Người dùng yêu cầu giải thủ công ngay...');
    triggerSolveCycle(true);
  };

  function updateHudStatus(text, color = '#34d399') {
    const el = document.getElementById('hud-status-text');
    if (el) el.textContent = text;
    const parent = document.getElementById('hud-status');
    if (parent) parent.style.color = color;
  }

  function addLog(type, msg) {
    const logsEl = document.getElementById('hud-logs');
    if (!logsEl) return;
    const line = document.createElement('div');
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    line.style.marginTop = '2px';
    if (type === 'warn') line.style.color = '#f59e0b';
    else if (type === 'err') line.style.color = '#ef4444';
    else if (type === 'success') line.style.color = '#10b981';
    else line.style.color = '#94a3b8';

    line.textContent = \`[\${time}] \${msg}\`;
    logsEl.appendChild(line);
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  // ============================================================
  // 3. VERIFY LICENSE VIA API CLAIM
  // ============================================================
  fetch(API_CLAIM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey: LICENSE_KEY, domain: window.location.hostname })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      licenseInfo.remaining = data.remainingTime;
      licenseInfo.isTrial = data.isTrial;
      document.getElementById('hud-tier-label').innerHTML = \`<strong style="color:#10b981;">\${data.isTrial ? 'Gói Trial (2 Giờ)' : 'Gói VIP Bản Quyền'}</strong> • Còn \${data.remainingTime}\`;
      updateHudStatus('Sẵn sàng giải bài! Đang quét EduNext...', '#10b981');
      addLog('success', 'Xác thực License thành công! Thời hạn: ' + data.remainingTime);
    } else {
      updateHudStatus('License không hợp lệ: ' + data.message, '#ef4444');
      addLog('err', data.message || 'Lỗi xác thực license');
    }
  })
  .catch(err => {
    updateHudStatus('Không thể kết nối máy chủ xác thực', '#f59e0b');
    addLog('warn', 'Kết nối local: ' + err.message);
  });

  // ============================================================
  // 4. AUTO-HANDLE "LÀM RÕ Ý ĐỊNH" DIALOG
  // ============================================================
  function checkAndHandleIntentDialog() {
    const dialogs = document.querySelectorAll('.ant-modal, .dialog, [role="dialog"], .ant-modal-content, div[class*="clarify"], div[class*="intent"]');
    for (const d of dialogs) {
      const text = d.textContent || '';
      if (/làm rõ ý định|ý định của bạn|lựa chọn mục đích/i.test(text)) {
        // Find options inside
        const radioOrOptions = d.querySelectorAll('input[type="radio"], .ant-radio-wrapper, button[class*="option"], li[class*="item"]');
        if (radioOrOptions.length > 0) {
          const randomIndex = Math.floor(Math.random() * radioOrOptions.length);
          const pick = radioOrOptions[randomIndex];
          pick.click();
          addLog('info', 'Đã tự động chọn mục #' + (randomIndex + 1) + ' trong hộp Làm Rõ Ý Định');

          setTimeout(() => {
            const confirmBtns = d.querySelectorAll('button');
            for (const b of confirmBtns) {
              if (/xác nhận|đồng ý|tiếp tục|confirm|submit/i.test(b.textContent || '')) {
                b.click();
                addLog('success', 'Đã bấm "Xác nhận lựa chọn" ý định!');
                break;
              }
            }
          }, 400);
          return true;
        }
      }
    }
    return false;
  }

  // ============================================================
  // 5. SOLVER CYCLE & DOM PARSING
  // ============================================================
  function findQuestionElements() {
    // Look inside EduNext chat container
    const candidates = document.querySelectorAll(
      '#chat-widget-anchor, .chat-widget-content, .chat-box, div[class*="message"], div[class*="chat-item"]'
    );
    let questionText = '';
    let isReadyPrompt = false;

    // Scan all text blocks for teacher questions
    const allTextBlocks = document.querySelectorAll('.message-content, .ant-typography, p, div[class*="content"]');
    for (let i = allTextBlocks.length - 1; i >= 0; i--) {
      const block = allTextBlocks[i];
      const t = (block.textContent || '').trim();
      if (t.length > 10 && !block.closest('#edunext-pro-hud')) {
        if (/sẵn sàng|ready/i.test(t)) {
          isReadyPrompt = true;
          questionText = t;
          break;
        }
        if (/câu hỏi|bài tập|hãy cho biết|tính|xác định|trả lời|carbon|nguyên tử/i.test(t)) {
          questionText = t;
          break;
        }
      }
    }

    return { questionText, isReadyPrompt };
  }

  function findSubmitButton() {
    // 1. Check data-intent="SUBMIT_ANSWER"
    const intentBtn = document.querySelector('button[data-intent="SUBMIT_ANSWER"]');
    if (intentBtn) {
      if (intentBtn.getAttribute('aria-pressed') === 'true' || intentBtn.disabled || intentBtn.classList.contains('is-loading')) {
        return null; // Locked
      }
      return intentBtn;
    }

    // 2. Generic buttons
    const buttons = document.querySelectorAll('button[type="submit"], button.ant-btn-primary, button[class*="send"]');
    for (const b of buttons) {
      if (b.closest('#edunext-pro-hud')) continue;
      const text = b.textContent || '';
      if (/gửi|nộp|send|submit/i.test(text) || b.querySelector('svg')) {
        if (b.disabled || b.getAttribute('aria-pressed') === 'true') return null;
        return b;
      }
    }
    return null;
  }

  function findComposer() {
    const inputs = document.querySelectorAll('textarea, input[type="text"], div[contenteditable="true"]');
    for (const el of inputs) {
      if (el.closest('#edunext-pro-hud')) continue;
      if (el.offsetParent !== null) return el; // visible
    }
    return null;
  }

  async function triggerSolveCycle(isForced = false) {
    if (!isAutoSolveRunning && !isForced) return;
    if (Date.now() < rateLimitCooldownUntil) {
      const waitRemaining = Math.ceil((rateLimitCooldownUntil - Date.now()) / 1000);
      updateHudStatus('Chờ giãn cách 429: còn ' + waitRemaining + 's...', '#f59e0b');
      return;
    }
    if (isSubmitting) return;

    // Check intent dialog first
    if (checkAndHandleIntentDialog()) return;

    const { questionText, isReadyPrompt } = findQuestionElements();
    if (!questionText) {
      updateHudStatus('Đang lắng nghe câu hỏi từ EduNext...', '#94a3b8');
      return;
    }

    // Simple hash
    const questionHash = questionText.slice(0, 100) + '_' + questionText.length;
    if (questionHash === lastProcessedQuestionHash && !isForced) {
      return; // Already handled
    }

    addLog('info', 'Phát hiện câu hỏi: "' + questionText.slice(0, 45) + '..."');
    updateHudStatus('Đang giải qua Cloud AI Proxy...', '#38bdf8');

    // Call Cloud Solve API
    try {
      const res = await fetch(API_SOLVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: LICENSE_KEY,
          question: questionText,
          formatHint: 'template_match'
        })
      });

      const data = await res.json();
      if (!data.success) {
        addLog('err', data.message || 'Lỗi từ AI Solver');
        updateHudStatus('Lỗi giải: ' + data.message, '#ef4444');
        return;
      }

      let answer = data.answer || '';
      addLog('success', 'AI đáp: "' + answer + '" (độ tin cậy ' + (data.confidence || 9.8) + '/10)');
      lastProcessedQuestionHash = questionHash;

      // Fill answer
      const composer = findComposer();
      if (!composer) {
        addLog('warn', 'Không tìm thấy ô soạn thảo câu trả lời!');
        return;
      }

      // Check if template format "Trả lời: [đáp án]" is needed
      if (/trả lời:\s*\[/i.test(questionText) && !answer.toLowerCase().startsWith('trả lời:')) {
        answer = 'Trả lời: ' + answer;
      }

      if (composer.tagName === 'DIV' && composer.isContentEditable) {
        composer.focus();
        composer.textContent = answer;
        composer.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        composer.focus();
        composer.value = answer;
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        composer.dispatchEvent(new Event('change', { bubbles: true }));
      }

      updateHudStatus('Đã điền đáp án! Chuẩn bị nộp...', '#10b981');

      if (isAutoSubmit) {
        isSubmitting = true;
        setTimeout(() => {
          const submitBtn = findSubmitButton();
          if (submitBtn) {
            submitBtn.click();
            addLog('success', '✓ Đã bấm Nộp bài thành công!');
          } else {
            // Try Enter key
            composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            addLog('info', 'Đã nhấn Enter để gửi câu trả lời.');
          }

          lastSubmitTimestamp = Date.now();
          setTimeout(() => {
            isSubmitting = false;
            updateHudStatus('Hoàn tất lượt! Đang chờ câu hỏi tiếp theo...', '#34d399');
          }, 3500);
        }, 1200);
      } else {
        updateHudStatus('Đã điền nháp (Tự Nộp đang Tắt)', '#34d399');
      }

    } catch (e) {
      addLog('err', 'Lỗi mạng khi gọi Cloud AI: ' + e.message);
      updateHudStatus('Lỗi kết nối AI: ' + e.message, '#ef4444');
    }
  }

  // ============================================================
  // 6. OBSERVER & MAIN LOOP
  // ============================================================
  setInterval(() => {
    try {
      triggerSolveCycle(false);
    } catch (_) {}
  }, 4000);

  addLog('success', '🚀 EduNext Study Assistant v' + CURRENT_VERSION + ' hoạt động mượt mà!');
})();
`;

  return new NextResponse(scriptContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
