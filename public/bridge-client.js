(() => {
  const logs = document.getElementById('logs');
  const status = document.getElementById('bridge-status');
  const allowed = new Set(['https://fu-edunext.fpt.edu.vn', 'https://fsc-edunext.fpt.edu.vn', 'https://edunext.fpt.edu.vn']);
  const opener = window.opener;
  let busy = false;
  function log(message) {
    const line = document.createElement('div'); line.textContent = message; logs.appendChild(line);
    while (logs.children.length > 30) logs.firstElementChild.remove();
    logs.scrollTop = logs.scrollHeight;
  }
  try { localStorage.removeItem('enx_bridge_gemini_key'); localStorage.removeItem('fpt_admin_master_gemini_key'); } catch (_) {}
  log('API key chỉ lưu trên máy chủ. Đang chờ yêu cầu có license hợp lệ.');
  window.addEventListener('message', async event => {
    if (!opener || event.source !== opener || !allowed.has(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ENX_PING') { opener.postMessage({ type: 'ENX_PONG' }, event.origin); return; }
    if (data.type !== 'ENX_SOLVE_REQ' || typeof data.requestId !== 'string' || data.requestId.length > 100) return;
    const respond = result => opener.postMessage({ type: 'ENX_SOLVE_RES', requestId: data.requestId, ...result }, event.origin);
    if (busy) { respond({ success: false, error: 'Đang xử lý câu trước.', status: 429 }); return; }
    const payload = data.payload;
    if (!payload || typeof payload.licenseKey !== 'string' || typeof payload.question !== 'string') { respond({ success: false, error: 'Hãy cài lại bookmarklet phiên bản mới.' }); return; }
    busy = true; status.textContent = 'Đang giải qua máy chủ…';
    try {
      const response = await fetch('/api/v1/ai/solve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenseKey: payload.licenseKey, question: payload.question, images: payload.images }), signal: AbortSignal.timeout(23000) });
      const result = await response.json();
      respond({ success: response.ok && result.success, answer: result.answer, error: result.message, status: response.status });
      log(result.success ? 'Đã trả kết quả về EduNext.' : result.message || 'Yêu cầu thất bại.');
    } catch { respond({ success: false, error: 'Mất kết nối hoặc quá thời gian. Chưa gửi bài.' }); }
    finally { busy = false; status.textContent = 'Đang chờ yêu cầu tiếp theo'; }
  });
  if (opener) for (const origin of allowed) opener.postMessage({ type: 'ENX_BRIDGE_READY' }, origin);
})();
