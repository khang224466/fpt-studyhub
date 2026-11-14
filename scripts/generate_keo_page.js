const fs = require('fs');
const path = require('path');

// Read source bundle
const bundleContent = fs.readFileSync(path.join(__dirname, '../src/lib/edunextBundle.ts'), 'utf8');
const match = bundleContent.match(/export const EDUNEXT_SOURCE = (.*?);\n/);
if (!match) {
  console.error('Could not find EDUNEXT_SOURCE in src/lib/edunextBundle.ts');
  process.exit(1);
}

const edunextSource = JSON.parse(match[1]);
const baseBookmarklet = `javascript:(${edunextSource})("");`;

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cài Đặt Bookmarklet EduNext AI Pro v10.2.50 — FPT Study Hub</title>
  <link rel="icon" href="https://fpt-studyhub.vercel.app/favicon.ico">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      background: radial-gradient(circle at top, #064e3b 0%, #022c22 35%, #020617 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .container {
      max-width: 760px;
      width: 100%;
      background: rgba(15, 23, 42, 0.95);
      border: 2px solid rgba(16, 185, 129, 0.5);
      border-radius: 24px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(16, 185, 129, 0.25);
      backdrop-filter: blur(20px);
      padding: 36px 28px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 9999px;
      color: #34d399;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    .alert-banner {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 22px;
      text-align: left;
      font-size: 13.5px;
      color: #fde68a;
      line-height: 1.6;
    }
    .alert-banner strong {
      color: #ffffff;
    }
    h1 {
      font-size: 26px;
      font-weight: 900;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 8px;
    }
    h1 span {
      background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.desc {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .main-copy-card {
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(2, 6, 23, 0.8) 100%);
      border: 2px solid rgba(16, 185, 129, 0.6);
      border-radius: 20px;
      padding: 24px 20px;
      margin-bottom: 24px;
      text-align: center;
    }
    .copy-title {
      font-size: 17px;
      font-weight: 800;
      color: #34d399;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .copy-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 18px 24px;
      background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
      color: #ffffff;
      font-size: 18px;
      font-weight: 900;
      border: none;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.6), 0 0 25px rgba(16, 185, 129, 0.35);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      border: 2px solid rgba(255, 255, 255, 0.25);
    }
    .copy-btn:hover {
      box-shadow: 0 15px 35px -5px rgba(16, 185, 129, 0.8), 0 0 35px rgba(16, 185, 129, 0.5);
      transform: translateY(-2px);
    }
    .copy-btn:active {
      transform: scale(0.98);
    }
    .steps-card {
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 18px;
      padding: 22px;
      text-align: left;
      margin-bottom: 24px;
    }
    .steps-card h3 {
      font-size: 14px;
      color: #38bdf8;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
      font-size: 13.5px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .step-item:last-child {
      margin-bottom: 0;
    }
    .step-num {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #34d399;
      font-weight: 800;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    kbd {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 2px 7px;
      color: #38bdf8;
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
    }
    .alt-methods {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 24px;
      text-align: left;
    }
    @media (max-width: 640px) {
      .alt-methods { grid-template-columns: 1fr; }
    }
    .alt-card {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 16px;
    }
    .alt-card h4 {
      font-size: 13px;
      font-weight: 800;
      color: #f1f5f9;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .alt-card p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .drag-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 10px;
      background: rgba(16, 185, 129, 0.2);
      border: 1px dashed #10b981;
      border-radius: 10px;
      color: #34d399;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: grab;
      user-select: none;
    }
    .drag-btn:hover {
      background: rgba(16, 185, 129, 0.3);
    }
    .tm-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 10px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 10px;
      color: #38bdf8;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }
    .tm-btn:hover {
      background: rgba(56, 189, 248, 0.25);
    }
    .footer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }
    .btn-secondary {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }
    .btn-secondary:hover {
      border-color: #10b981;
      color: #34d399;
      background: #0f172a;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: #000;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 14px;
      box-shadow: 0 10px 30px rgba(16, 185, 129, 0.6);
      display: none;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="badge">⚡ EduNext AI Assistant Pro v10.2.50 (Bản Chuẩn 35s)</div>

    <div class="alert-banner">
      ⚠️ <strong>BẠN KHÔNG KÉO / NÉM ĐƯỢC LÊN THANH BOOKMARK?</strong><br>
      Trình duyệt Chrome, Edge, Cốc Cốc trên Windows có giới hạn hệ thống: <strong>Chặn kéo thả các đường link dài hơn 2.000 ký tự</strong> (trong khi bản v10.2.50 tích hợp đầy đủ trí tuệ nhân tạo nhận diện câu hỏi, giải bài tự động 35s và vượt bảo mật nên dài 34.000 ký tự).<br>
      👉 <strong>ĐỪNG KÉO NỮA! HÃY LÀM THEO CÁCH 1 BÊN DƯỚI (MẤT ĐÚNG 5 GIÂY - 100% THÀNH CÔNG)!</strong>
    </div>

    <h1>Cài Đặt Bookmarklet <span>EduNext AI Pro</span></h1>
    <p class="desc">Bản độc lập 100% — Vượt mọi rào cản Cloudflare / Content Security Policy (CSP) của FPT EduNext.</p>

    <!-- CÁCH 1: KHUYÊN DÙNG -->
    <div class="main-copy-card">
      <div class="copy-title">
        <span>⭐</span>
        <span>CÁCH 1: TẠO BOOKMARK THỦ CÔNG (100% THÀNH CÔNG TRÊN MỌI MÁY)</span>
      </div>
      <button id="btn-copy-code" class="copy-btn" onclick="copyBookmarklet()">
        <span>📋</span>
        <span id="copy-btn-text">BẤM VÀO ĐÂY ĐỂ SAO CHÉP MÃ v10.2.50</span>
      </button>
    </div>

    <div class="steps-card">
      <h3>🚀 4 Bước Cực Dễ (Chỉ Làm 1 Lần Duy Nhất):</h3>
      <div class="step-item">
        <div class="step-num">1</div>
        <div><strong>Bấm nút màu xanh ở trên</strong> để sao chép mã Bookmarklet vào bộ nhớ máy.</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div>Nhấn phím <kbd>Ctrl + Shift + B</kbd> trên bàn phím để hiện thanh Bookmark trình duyệt (nếu chưa thấy).</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div>
          Nhấp <strong>Chuột Phải</strong> vào khoảng trống bất kỳ trên thanh Bookmark &rarr; Chọn <strong>Thêm trang...</strong> (hoặc <strong>Add page...</strong>):<br>
          • Ô <strong>Tên</strong>: Gõ <kbd>EduNext Pro 35s</kbd><br>
          • Ô <strong>URL</strong>: Nhấn <kbd>Ctrl + V</kbd> (Dán mã vừa sao chép) &rarr; Bấm <strong>Lưu</strong> (Save).
        </div>
      </div>
      <div class="step-item">
        <div class="step-num">4</div>
        <div>
          Mở tab EduNext: <strong style="color: #34d399;">https://fsc-edunext.fpt.edu.vn/home</strong> &rarr; <strong>BẤM VÀO DẤU TRANG "EduNext Pro 35s" VỪA TẠO</strong> &rarr; Bảng điều khiển màu xanh v10.2.50 hiện ra ngay lập tức và tự động đếm ngược 35s giải bài!
        </div>
      </div>
    </div>

    <!-- CÁCH DỰ PHÒNG -->
    <div class="alt-methods">
      <div class="alt-card">
        <h4><span>📥</span> Cách 2: Cài Qua Tampermonkey</h4>
        <p>Nếu máy bạn đã cài sẵn tiện ích Tampermonkey hoặc Violentmonkey, chỉ cần bấm nút bên dưới để cài tự động (tự chạy mỗi khi vào EduNext).</p>
        <a class="tm-btn" href="/edunext.user.js" target="_blank">Cài Đặt Bằng Tampermonkey</a>
      </div>
      <div class="alt-card">
        <h4><span>🖱️</span> Cách 3: Kéo Thả (MacOS / Safari)</h4>
        <p>Dành riêng cho máy Mac hoặc Firefox có hỗ trợ kéo link dài lên thanh Bookmark:</p>
        <a id="drag-bookmark-link" class="drag-btn" href="#" draggable="true">
          <span>⚡</span>
          <span>Kéo Nút Này Lên Thanh Bookmark</span>
        </a>
      </div>
    </div>

    <div class="footer-actions">
      <a class="btn-secondary" href="https://fsc-edunext.fpt.edu.vn/home" target="_blank">🌐 Mở Tab EduNext FPT</a>
      <a class="btn-secondary" href="/admin" target="_blank">⚙️ Trang Quản Trị Admin</a>
    </div>
  </div>

  <div id="toast" class="toast">✓ ĐÃ SAO CHÉP MÃ v10.2.50! BÂY GIỜ CHUỘT PHẢI THANH BOOKMARK &rarr; THÊM TRANG &rarr; DÁN URL!</div>

  <script>
    const INLINE_CODE = ${JSON.stringify(baseBookmarklet)};

    // 1. Nhận diện key bản quyền từ URL (?key=ENC_AI_...) hoặc localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let activeKey = urlParams.get('key') || '';
    if (!activeKey) {
      try {
        activeKey = localStorage.getItem('enx_encrypted_ai_key') || localStorage.getItem('enx_license_key') || '';
      } catch(_) {}
    } else {
      try {
        localStorage.setItem('enx_encrypted_ai_key', activeKey);
        localStorage.setItem('enx_license_key', activeKey);
      } catch(_) {}
    }

    // 2. Tự động nạp Key vào mã nếu có
    let finalCode = INLINE_CODE;
    if (activeKey && activeKey.startsWith('ENC_AI_')) {
      finalCode = INLINE_CODE.replace(/\\)\\(\"\"\\);?$/, ')(' + JSON.stringify(activeKey) + ');');
      const badgeEl = document.querySelector('.badge');
      if (badgeEl) {
        badgeEl.textContent = '🔑 ĐÃ NẠP SẴN BẢN QUYỀN VÀO MÃ BOOKMARK (TỰ ĐỘNG 100%)';
        badgeEl.style.background = 'rgba(16, 185, 129, 0.25)';
        badgeEl.style.borderColor = '#10b981';
      }
      const bannerEl = document.querySelector('.alert-banner');
      if (bannerEl) {
        bannerEl.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        bannerEl.style.background = 'rgba(16, 185, 129, 0.15)';
        bannerEl.style.color = '#a7f3d0';
        bannerEl.innerHTML = '✓ <strong>KEY BẢN QUYỀN ĐÃ ĐƯỢC TỰ ĐỘNG NẠP VÀO MÃ!</strong><br>Bạn chỉ cần bấm nút [SAO CHÉP MÃ] bên dưới &rarr; Chuột phải thanh Bookmark chọn Thêm trang &rarr; Dán vào là xong ngay!';
      }
    }

    // Gán href cho nút kéo dự phòng
    const dragLink = document.getElementById('drag-bookmark-link');
    if (dragLink) dragLink.setAttribute('href', finalCode);

    function copyBookmarklet() {
      navigator.clipboard.writeText(finalCode).then(() => {
        const toast = document.getElementById('toast');
        if (toast) {
          toast.style.display = 'block';
          setTimeout(() => { toast.style.display = 'none'; }, 4000);
        }
        const btnText = document.getElementById('copy-btn-text');
        if (btnText) {
          btnText.textContent = '✓ ĐÃ SAO CHÉP! HÃY CHUỘT PHẢI THANH BOOKMARK & DÁN URL';
          setTimeout(() => {
            btnText.textContent = '📋 BẤM VÀO ĐÂY ĐỂ SAO CHÉP MÃ v10.2.50';
          }, 3500);
        }
      }).catch(err => {
        alert('Vui lòng chọn và sao chép thủ công: ' + err.message);
      });
    }
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '../public/keo_bookmark.html'), html, 'utf8');
console.log('Successfully generated public/keo_bookmark.html with length:', html.length);
