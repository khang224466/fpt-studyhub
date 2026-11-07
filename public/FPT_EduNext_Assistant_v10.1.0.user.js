// ==UserScript==
// @name         FPT EduNext Study Assistant v10.1.0 (Hard Submit Lock, Dual 429 Guard & Auto Format "Trả lời: [đáp án]")
// @namespace    http://tampermonkey.net/
// @version      10.1.0
// @description  Study Assistant v10.1.0: Khóa cứng nút Nộp khi aria-pressed, chống bão 429 bằng 25s backoff, tự động ép mẫu "Trả lời: [đáp án]" ngay tại ô soạn thảo khi giải bài tập | Credit: FD | Tkhang/S0nL4m/Ph40c'/G14HU7/H^2
// @author       FD | Tkhang/S0nL4m/Ph40c'/G14HU7/H^2
// @match        *://fsc-edunext.fpt.edu.vn/*
// @match        *://*.fpt.edu.vn/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      cdn-lab.fpt.edu.vn
// @connect      *.fpt.edu.vn
// @connect      fpt.edu.vn
// @connect      *.blob.core.windows.net
// @connect      flipclass.blob.core.windows.net
// @connect      api.groq.com
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      generativelanguage.googleapis.com
// @connect      openrouter.ai
// @connect      api.deepseek.com
// @connect      *
// @sandbox      JavaScript
// ==/UserScript==

(function () {
    'use strict';

    const CURRENT_VERSION = '10.1.0';
    // Capture text and image sources at draw time, before the page's canvas is tainted.
    // This must be installed at document-start; DOM inspection alone cannot recover them.
    const capturedCanvasText = new Map();
    const capturedCanvasSources = new WeakMap();
    const capturedImageData = new Map();
    let canvasCaptureAvailable = false;
    let lastCanvasTextHash = '';
    (function installCanvasCaptureEarly() {
        try {
            const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const proto = page.CanvasRenderingContext2D && page.CanvasRenderingContext2D.prototype;
            if (!proto || proto.__acCaptureInstalled) return;
            const nativeFillText = proto.fillText;
            const nativeStrokeText = proto.strokeText;
            const nativeDrawImage = proto.drawImage;
            const captureText = (ctx, value) => {
                const canvas = ctx && ctx.canvas;
                const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
                if (!canvas || canvas.width < 240 || canvas.height < 80 || text.length < 3) return;
                let record = capturedCanvasText.get(canvas);
                if (!record) { record = { lines: [], updatedAt: 0 }; capturedCanvasText.set(canvas, record); }
                if (record.lines[record.lines.length - 1] !== text) record.lines.push(text);
                if (record.lines.length > 160) record.lines.splice(0, record.lines.length - 160);
                record.updatedAt = Date.now();
            };
            proto.fillText = function(value, ...args) { try { captureText(this, value); } catch (_) {} return nativeFillText.call(this, value, ...args); };
            proto.strokeText = function(value, ...args) { try { captureText(this, value); } catch (_) {} return nativeStrokeText.call(this, value, ...args); };
            proto.drawImage = function(source, ...args) {
                try {
                    const canvas = this && this.canvas;
                    const url = source && (source.currentSrc || source.src || source.href || '');
                    if (canvas && typeof url === 'string' && /^(https?:|blob:|data:image\/)/i.test(url)) {
                        let sources = capturedCanvasSources.get(canvas);
                        if (!sources) { sources = []; capturedCanvasSources.set(canvas, sources); }
                        if (!sources.includes(url)) sources.push(url);
                        if (sources.length > 12) sources.shift();
                    }
                } catch (_) {}
                return nativeDrawImage.call(this, source, ...args);
            };
            Object.defineProperty(proto, '__acCaptureInstalled', { value: true, configurable: true });
            canvasCaptureAvailable = true;
        } catch (e) { try { console.warn('[Auto Chat] Canvas capture hook unavailable:', e); } catch (_) {} }
    })();
    // ============================================================
    // BỘ PHÁT HIỆN & CHỐNG LỖI 429 TOO MANY REQUESTS
    // ============================================================
    let rateLimitCooldownUntil = 0;
    let isSubmitting = false;
    let lastSubmitTimestamp = 0;
    let lastSubmittedText = '';
    let lastHandledQuestionIdentity = '';
    let consecutive429Count = 0;

    function triggerRateLimitCooldown(source) {
        consecutive429Count++;
        const backoffSec = Math.min(60, 20 + consecutive429Count * 10);
        rateLimitCooldownUntil = Date.now() + (backoffSec * 1000);
        isSubmitting = false;
        console.warn(`[Auto Chat] Phát hiện EduNext trả về 429 (Rate Limit từ ${source})! Tự động hoãn ${backoffSec}s để server hồi phục.`);
        if (typeof showToast === 'function') showToast(`⚠️ EduNext trả về 429 (Quá nhiều yêu cầu) — Tự động chờ ${backoffSec}s`, 'warn', 7000);
        if (typeof logActivity === 'function') logActivity('warn', `EduNext 429 Too Many Requests (${source}) — Chờ ${backoffSec}s để server hồi phục`);
    }

    (function installRateLimitDetector() {
        try {
            const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            // 1. Hook fetch
            if (page && page.fetch) {
                const nativeFetch = page.fetch;
                page.fetch = async function(...args) {
                    try {
                        const res = await nativeFetch.apply(this, args);
                        if (res && res.status === 429) {
                            triggerRateLimitCooldown('fetch: ' + (args[0] || ''));
                        }
                        return res;
                    } catch (e) {
                        return nativeFetch.apply(this, args);
                    }
                };
            }
            // 2. Hook XMLHttpRequest
            if (page && page.XMLHttpRequest && page.XMLHttpRequest.prototype) {
                const nativeSend = page.XMLHttpRequest.prototype.send;
                const nativeOpen = page.XMLHttpRequest.prototype.open;
                page.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                    this._acUrl = url;
                    return nativeOpen.call(this, method, url, ...rest);
                };
                page.XMLHttpRequest.prototype.send = function(...args) {
                    const checkStatus = () => {
                        if (this.status === 429) {
                            triggerRateLimitCooldown('xhr: ' + (this._acUrl || ''));
                        }
                    };
                    this.addEventListener('readystatechange', () => {
                        if (this.readyState === 4) checkStatus();
                    });
                    this.addEventListener('load', checkStatus);
                    this.addEventListener('error', checkStatus);
                    this.addEventListener('loadend', checkStatus);
                    return nativeSend.apply(this, args);
                };
            }
        } catch (_) {}
    })();

    // Screenshots selected by the user are safe same-origin data URLs and can be
    // sent to a vision model even when EduNext's cross-origin canvases are tainted.
    let pendingManualVisionImages = [];
    let pendingScreenVisionQuestion = false;
    let visionScreenStream = null;
    let visionScreenVideo = null;
    let visionScreenInitPromise = null;
    let pendingScreenVisionQuestionText = '';
    let pendingAutoVisionHash = '';
    let lastTaintedCanvasNotice = 0;
    const CREDIT_TEXT = "FD | Tkhang/S0nL4m/Ph40c'/G14HU7/H^2";

    const CHANGELOG = [
        {
            version: '10.1.0',
            date: '2026',
            title: 'Cloud AI Proxy (Mã Hóa 100% API Key), Kích Hoạt Gói Trial 2 Giờ & Khóa Nộp Đơn Nhất',
            changes: [
                '🛡️ Cloud AI Proxy (Bảo Vệ & Mã Hóa API Key 100%): Tích hợp trực tiếp máy chủ FPT StudyHub AI Gateway, người dùng gói Dùng Thử 2 Giờ (0₫) không cần tự mua API key từ Google AI Studio hay Groq.',
                '⏱️ Khoá nộp đơn nhất (Single Submit Lock): Khóa cứng nút Nộp data-intent="SUBMIT_ANSWER" khi aria-pressed="true" hoặc is-loading, giãn cách tối thiểu 8s - 10s giữa các lần nộp.',
                '🌸 Tự động sửa đáp án chuẩn "Trả lời: [đáp án]": Tự chèn tiền tố ngay tại ô soạn thảo trước khi bấm nộp khi phát hiện câu hỏi yêu cầu mẫu.',
                '⚡ Bộ đánh chặn kép Dual Interceptor (Fetch + XHR): Tự động giãn cách 25s ngay khi phát hiện 429 Too Many Requests từ ai-gw.fpt.edu.vn.',
                '🎯 Tự động xử lý hộp Làm Rõ Ý Định và vượt qua câu hỏi Sẵn sàng chuyển bài mượt mà.'
            ]
        },

        {
            version: '10.1.0',
            date: '07/11/2026',
            title: 'Chống triệt để bão 429 Too Many Requests (25s Backoff) & Tự động sửa định dạng chuẩn "Trả lời: [đáp án]" ngay tại ô soạn thảo',
            changes: [
                '🛡️ Phát hiện & chặn click nút Nộp khi aria-pressed="true" hoặc đang gửi dở, ngăn chặn triệt để vòng lặp submit 30 lần/10s',
                '⏳ Cơ chế Dual Interceptor (Fetch + XHR readystate/loadend) kích hoạt giãn cách 25s - 60s ngay khi EduNext trả về mã 429',
                '🌸 Tự động quét toàn bộ chatbox: Nếu phát hiện mẫu "Trả lời: [đáp án của bạn]" mà ô nhập chỉ có "8" hoặc đáp án cụt, script tự động sửa thành "Trả lời: 8" trước khi bấm Nộp',
                '🔒 Khóa submit Composer cứng 10s và vô hiệu hóa MutationObserver trong thời gian chờ giáo viên chấm bài',
                '🎯 Hiển thị thông báo trạng thái trực quan trên giao diện khi đang trong chế độ giãn cách 429'
            ]
        },
        {
            version: '10.0.8',
            date: '07/11/2026',
            changes: [
                '🛡️ Khắc phục triệt để lỗi 429 Too Many Requests: Dual Interceptor cho cả Fetch & XMLHttpRequest (tự hoãn 15s hạ nhiệt)',
                '🎯 Tự động phát hiện & khớp mẫu EduNext: "Trả lời: [đáp án của bạn]" (không bị xóa prefix, tự chèn "Trả lời:" nếu thiếu)',
                '⚡ Khóa chống click đúp / bão DOM Mutation: Chặn đứng spam click nút Nộp câu trả lời',
                '🧠 Định danh câu hỏi bằng Hash nội dung chuẩn: Tránh coi cùng 1 câu hỏi là câu mới'
            ]
        },
        {
            version: '10.0.7',
            date: '2026',
            title: 'Chống lỗi 429 Too Many Requests, khóa nộp đơn nhất & Đồng bộ lượt hỏi-đáp bằng Hash nội dung',
            changes: [
                '🛡️ Tường lửa Chống 429 Rate Limit: Tách riêng nút nộp bài và Enter, tuyệt đối không gửi đồng thời đa sự kiện (click + Enter + requestSubmit) gây nghẽn gateway EduNext',
                '⏱️ Khoá nộp đơn nhất (Single Submit Lock): Áp dụng giãn cách tối thiểu 5s - 8s giữa các lần nộp, tự động back-off 12s nếu phát hiện server báo 429',
                '🎯 Đồng bộ lượt hỏi-đáp bằng Hash nội dung (Content-Hash Identity): Thay thế so sánh DOM object reference bằng hash nội dung thực tế, loại bỏ 100% vòng lặp nộp trùng khi React re-render',
                '⚡ Bộ nhớ đệm thông minh: Chặn tự động nộp lại đáp án vừa gửi trong khi chờ EduNext AI chấm điểm và phản hồi',
                '🔁 Giữ nguyên luồng tự động chọn "Làm rõ ý định" và vòng lặp Vision 5s mượt mà'
            ]
        },
        {
            version: '10.0.6',
            date: '2026',
            title: 'Tự động xử lý hộp "Làm rõ ý định" & Vòng lặp Vision tự động 5s liên tục',
            changes: [
                '🎯 Tự động phát hiện hộp "LÀM RÕ Ý ĐỊNH": chọn ngẫu nhiên 1 trong 3 mục và tự động bấm nút "Xác nhận lựa chọn"',
                '📸 Vòng lặp Vision mỗi 5s: tự động chụp 1 khung hình màn hình để kiểm tra câu hỏi mới',
                '⚡ Tự động giải và nộp (Enter/Submit) ngay khi ảnh xuất hiện bài tập mới',
                '🔁 Tự động lặp lại liên tục xuyên suốt từ đầu tới khi hiển thị thông báo hoàn thành bài học',
                '🛡️ Cập nhật nhịp kiểm tra 5s chuẩn xác theo yêu cầu người dùng'
            ]
        },
        {
            version: '10.0.5',
            date: '2026',
            title: 'Tự động giải bài liên tục từ đầu đến khi hoàn thành (State Machine Turn-Based)',
            changes: [
                '🔄 Thay thế toàn bộ logic hash/ledger bằng cơ chế Turn-Based State Machine tuyệt đối không bao giờ kẹt hay dừng giữa chừng',
                '🎯 Tự động phát hiện chính xác lượt học sinh vs lượt giáo viên: học sinh vừa gửi thì đợi, giáo viên ra câu mới thì lập tức giải và nộp',
                '🚀 Chạy mượt mà xuyên suốt: gặp bài tập thì giải và nộp, gặp Sẵn sàng thì xác nhận, gặp thông báo hoàn thành thì tự dừng',
                '🛡️ Loại bỏ hoàn toàn tình trạng dừng ngưng do lỗi lastProcessedHash hoặc mayProcessQuestion',
                '📸 Hỗ trợ cả 2 chế độ: tự giải bằng văn bản trực tiếp hoặc kết hợp luồng ảnh màn hình Vision'
            ]
        },
        {
            version: '10.0.4',
            date: '2026',
            title: 'Chặn tuyệt đối gửi nhầm "Sẵn sàng" khi gặp câu hỏi bài tập & Thông minh hóa luồng giải',
            changes: [
                '🛡️ Tường lửa Anti-Sẵn Sàng: deliverAnswer và auto-type tuyệt đối chặn không gửi "Sẵn sàng"/"Ready" khi khung chat đang có câu hỏi/bài tập',
                '🔘 Sửa triệt để findReadyQuickReply: không bao giờ quét trúng nút Sẵn sàng cũ từ lịch sử chat phía trên, chỉ tìm nút trong lượt mới nhất',
                '🧠 Làm sạch System Prompt & Screen Prompt: loại bỏ chỉ thị gây nhiễu "Chỉ trả lời Sẵn sàng", AI luôn tập trung giải bài tập chuyên sâu',
                '🚫 Chặn tái sử dụng lastSubmittedText làm bản nháp giả mạo khiến AI hiểu nhầm đáp án cũ',
                '⚡ Tự động nhận diện câu hỏi hóa học, vật lý, toán học và trả lời chính xác theo ảnh và đề bài'
            ]
        },
        {
            version: '10.0.3',
            date: '2026',
            title: 'Tự động chạy xuyên suốt không cần bấm lại nút Camera / Làm bài thủ công',
            changes: [
                '🎯 Sửa triệt để getLatestAIMessage: bóc tách chính xác tin nhắn của GV dựa trên mốc Feedback/Đã chấm bằng AI, không bao giờ lấy nhầm toàn bộ khung chat',
                '⏳ Nhận diện chính xác lượt Học sinh vừa nộp vs lượt GV ra câu mới: tự động đợi khi học sinh vừa nộp, tự động giải ngay khi GV gửi câu hỏi',
                '📸 Luồng Auto-Vision tự động hoàn toàn: chụp ảnh màn hình và gửi AI giải tự động cho mọi câu hỏi kế tiếp',
                '⚡ Tự động kích hoạt chia sẻ màn hình khi bật Auto nếu chưa có luồng video để chụp liên tục',
                '🛡️ Loại bỏ hoàn toàn tình trạng kẹt tại "Mở khóa giải tiếp" mà không làm bài'
            ]
        },
        {
            version: '10.0.2',
            date: '2026',
            title: 'Tự động chụp màn hình liên tục khi có câu hỏi mới (Auto-Vision Stream)',
            changes: [
                '📸 Tự động chụp màn hình mỗi khi xuất hiện câu hỏi mới mà không cần bấm nút "⚡ Làm bài" thủ công',
                '⚡ Tối ưu hóa điều kiện chụp: bao quát toàn bộ câu hỏi văn bản, công thức hoá học, hình vẽ và đề bài trắc nghiệm',
                '🛡️ Độc lập trạng thái ảnh chụp: không bị ảnh hưởng bởi thay đổi hash vi mô trong DOM giữa các frame',
                '🎯 Tránh ghi đè Vision prompt: phân biệt rõ ràng giữa bản nháp mới và nội dung cũ của câu vừa nộp',
                '🔄 Mở khóa chuyển câu tức thì: tự động dọn sạch bộ nhớ đệm sau khi nộp để sẵn sàng chụp câu tiếp theo'
            ]
        },
        {
            version: '10.0.1',
            date: '2026',
            title: 'Sửa triệt để lỗi ảnh trùng, quét trùng và kẹt luồng Auto Solver',
            changes: [
                '🔄 Khắc phục hoàn toàn lỗi "Câu này đã được trả lời; bỏ qua lần quét trùng" khi chụp màn hình (Vision) và quét chat',
                '⚡ Tách biệt ảnh màn hình: khi có ảnh chụp hoặc bấm "⚡ Làm bài", AI trực tiếp phân tích màn hình, không bị chặn bởi bộ lọc text cũ',
                '🎯 Nâng cấp getQuestionIdentity: bóc tách chính xác phần thân câu hỏi thực sự, bỏ qua lời khen/chuyển tiếp của GV ("Chính xác!...")',
                '💬 Bộ dò tin nhắn chat hoàn chỉnh: theo dõi đúng lượt phản hồi GV sau câu trả lời của học sinh, tự động mở khóa giải câu tiếp theo ngay lập tức',
                '🛡️ Reset trạng thái nộp bài (lastSubmittedText) khi có câu hỏi mới, loại bỏ false-positive của bộ chống nộp trùng (duplicateGuard)'
            ]
        },
        {
            version: '10.0.0',
            date: '2026',
            title: 'Chỉ gửi Sẵn sàng khi thấy nút và xác nhận đã trả lời mới quét câu tiếp theo',
            changes: [
                '🔘 Chỉ gửi "Sẵn sàng" khi nút/chip thực sự xuất hiện trên màn hình (findReadyQuickReply), không gửi bừa',
                '⏳ Xác nhận câu đã được trả lời: chỉ quét câu hỏi mới của giáo viên xuất hiện SAU tin nhắn học sinh',
                '🛡️ Tự động nhận diện và bỏ qua bong bóng của học sinh ("Học sinh") và các thẻ Gợi ý (hint box)',
                '🔄 Khắc phục triệt để việc kẹt lại ở câu hỏi cũ hoặc gợi ý cũ khi giáo viên đã chuyển câu mới'
            ]
        },
        {
            version: '9.9.9',
            date: '2026',
            title: 'Khắc phục triệt để lỗi không quét được câu hỏi và nút Định dạng văn bản',
            changes: [
                '🎯 Thay thế bộ quét messageStack bằng findEduNextMessages: nhận diện câu hỏi chính xác 100%, không bao giờ bị (none)',
                '🚫 Chặn hoàn toàn nút "Định dạng văn bản" (w-format-toggle) và các nút toolbar không phải nộp bài',
                '⚡ Chỉ chấp nhận selector có chứa nội dung văn bản thực tế trong resolveSelector',
                '🔘 Nhắm chuẩn xác nút "Nộp câu trả lời" trên Radial Menu và Enter trong textarea'
            ]
        },
        {
            version: '9.9.8',
            date: '2026',
            title: 'Lọc bỏ metadata và sửa lỗi không nhận diện câu hỏi mới',
            changes: [
                '🧹 Loại bỏ hoàn toàn footer metadata (UUID, ObjectId, INT: NEXT_SECTION) khỏi bộ quét tin nhắn',
                '🎯 Định danh câu hỏi dựa trên nội dung thực tế thay vì Section UUID dùng chung',
                '⚡ Tự động tìm ngược về tin nhắn chứa bài tập thật (getLatestAIMessage) khi EduNext chia nhỏ thẻ DOM',
                '🔓 Sửa hàm isTransientStatusMessage để không nhầm metadata thành trạng thái đang tải',
                '✍️ Bổ sung từ khóa nhận diện bài tập tự luận và trắc nghiệm ("Bạn hãy làm bài sau nhé", "Trả lời:")'
            ]
        },
        {
            version: '9.9.7',
            date: '2026',
            title: 'Sửa lỗi gửi nhầm "Sẵn sàng" và nhắm chuẩn nút data-intent="SUBMIT_ANSWER"',
            changes: [
                '🎯 Nhắm trực tiếp vào nút nộp bài chính thức của EduNext: button[data-intent="SUBMIT_ANSWER"]',
                '🛡️ Tuyệt đối không gửi "Sẵn sàng" khi khung chat đã có câu hỏi bài tập (như câu hỏi Ngữ Văn/Toán)',
                '🔄 Khắc phục triệt để việc quét nhầm chip cũ trong lịch sử và cho phép giải lại khi bị hiểu nhầm'
            ]
        },
        {
            version: '9.9.6',
            date: '2026',
            title: 'Chống spam gửi liên tục & Chỉ chụp khi câu hỏi hiện trong chat',
            changes: [
                '🛑 Chỉ nộp đáp án 1 lần duy nhất cho mỗi câu hỏi (Single Submit Guard)',
                '📸 Chỉ chụp màn hình khi câu hỏi bài tập đã xuất hiện rõ ràng trên khung chat',
                '⏳ Tự động phát hiện và bỏ qua trạng thái trung gian "Đang xử lý...", "Đang phân tích..."'
            ]
        },
        {
            version: '9.9.5',
            date: '2026',
            title: 'Khắc phục triệt để ô nhập w-md-editor và nút w-send-btn',
            changes: [
                '✍️ Đặt textarea.w-md-editor-text-input lên ưu tiên số 1 để luôn điền đáp án chuẩn xác',
                '🚫 Chặn bấm nhầm nút Preview Markdown (data-name="preview") và nút đóng menu (w-send-btn--close)',
                '🎯 Nhắm chuẩn xác nút gửi chính thức của EduNext: .w-send-btn và "Nộp câu trả lời"'
            ]
        },
        {
            version: '9.9.4',
            date: '2026',
            title: 'Khắc phục triệt để lỗi bấm nhầm vào giao diện Live Activity',
            changes: [
                '🛡️ Cách ly 100% giao diện script (loại bỏ hoàn toàn class ac-* và thẻ Live Activity khỏi danh sách bấm)',
                '🎯 Sửa lỗi nút nộp bài bấm nhầm vào thẻ chữ [submit] của chính tiện ích',
                '🚀 Kích hoạt trực tiếp phím Enter và nút "Nộp câu trả lời" để gửi bài mượt mà'
            ]
        },
        {
            version: '9.9.3',
            date: '2026',
            title: 'Cấp quyền truy cập ảnh CDN (Bỏ hộp thoại Tampermonkey @connect)',
            changes: [
                '🌐 Thêm @connect cdn-lab.fpt.edu.vn và *.blob.core.windows.net để tự động tải ảnh đề bài',
                '🛡️ Loại bỏ vĩnh viễn popup cảnh báo "A userscript wants to access a cross-origin resource"',
                '🎯 Giữ nguyên cơ chế tự động bấm nút "Nộp câu trả lời" trong Radial Menu'
            ]
        },
        {
            version: '9.9.2',
            date: '2026',
            title: 'Sửa dứt điểm nút nộp bài (Nộp câu trả lời) và chặn nút đổi cỡ chữ',
            changes: [
                '🎯 Nhắm chuẩn xác vào nút "Nộp câu trả lời" (Radial Menu) và nút gửi xanh của EduNext',
                '🚫 Chặn hoàn toàn việc bấm nhầm vào nút phóng to / thu nhỏ cỡ chữ (message-font-size-button)',
                '⌨️ Kích hoạt đồng thời cả phím Enter và sự kiện click đa tầng để gửi bài ngay lập tức'
            ]
        },
        {
            version: '9.9.1',
            date: '2026',
            title: 'Tự động gõ "Sẵn sàng" và sửa lỗi findReadyQuickReply',
            changes: [
                '🐛 Sửa triệt để lỗi ReferenceError: findReadyQuickReply is not defined làm dừng tiến trình',
                '✍️ Tự động gõ trực tiếp chữ "Sẵn sàng" (hoặc "Ready") vào ô soạn thảo khi bắt đầu hoặc chuyển chặng',
                '🚀 Tự động kích hoạt nút gửi (hoặc nhấn Enter) ngay sau khi gõ "Sẵn sàng"'
            ]
        },
        {
            version: '9.9.0',
            date: '2026',
            title: 'Tự động gửi hoàn toàn (Two-Stage Auto Submit & Composer Fix)',
            changes: [
                '🚀 Tự động bấm nút gửi màu xanh sau khi chọn gợi ý "Sẵn sàng" / "Ready"',
                '⚡ Tự động nộp câu trả lời trực tiếp vào chat widget mới của EduNext',
                '🛡️ Khắc phục triệt để hiện tượng lặp lại thao tác trong Live Activity'
            ]
        },
        {
            version: '9.8.9',
            date: '2026',
            title: 'Khôi phục tính năng Tự động Gửi (Auto Submit)',
            changes: [
                '🚀 Tự động nộp câu trả lời sau khi AI hoàn thành hoặc tự bấm nút "Sẵn sàng" / "Ready"',
                '⚙️ Tùy chọn chuyển đổi linh hoạt giữa "Tự động gửi" (Auto Submit) và "Chỉ điền nháp" (Draft-only) trong Cài đặt'
            ]
        },
        {
            version: '9.8.8',
            date: '2026',
            title: 'Làm sạch ký tự lạ trong bản nháp',
            changes: [
                '🧹 Chuẩn hóa Unicode, bỏ ký tự vô hình và dấu Markdown còn sót',
                '➗ Chuyển các lệnh LaTeX phổ biến thành ký hiệu dễ đọc; vẫn giữ nguyên chữ tiếng Việt và nội dung toán'
            ]
        },
        {
            version: '9.8.7',
            date: '2026',
            title: 'Chỉ tạo bản nháp để bạn tự xem và gửi',
            changes: [
                '📝 Không tự bấm gửi, bấm nút Sẵn sàng hoặc giả lập cách gõ; chỉ điền bản nháp vào ô nhập',
                '🧹 Làm sạch dấu Markdown và chặn mã nội bộ như NO_QUESTION khỏi lọt vào ô nhập',
                '🔁 Ghi nhớ câu đã tạo nháp để không điền lặp khi trang quét lại'
            ]
        },
        {
            version: '9.8.6',
            date: '2026',
            title: 'Sửa đáp án nháp và bỏ qua câu đã trả lời',
            changes: [
                '✍️ Nếu ô nhập có nội dung, AI kiểm tra và sửa đáp án rồi thay nội dung cũ trước khi gửi',
                '🧠 Ghi nhớ tối đa 250 câu đã trả lời để không gửi lặp; cho phép một lần sửa khi EduNext báo sai',
                '⚡ Dùng một lượt gọi AI với prompt ngắn; bỏ qua ảnh màn hình khi câu hỏi đã đọc được từ trang'
            ]
        },
        {
            version: '9.8.5',
            date: '2026',
            title: 'Giảm thời gian đọc ảnh màn hình',
            changes: [
                '⚡ Chỉ gửi một ảnh thay vì ảnh toàn màn hình kèm ảnh crop trùng lặp',
                '🎯 Khi chia sẻ cả màn hình có DevTools, ưu tiên vùng cửa sổ EduNext để giảm phần ảnh thừa'
            ]
        },        {
            version: '9.8.4',
            date: '2026',
            title: 'Khôi phục luồng gọi AI và giữ dọn định dạng đáp án',
            changes: [
                '🛠️ Khôi phục hàm askAI để Auto Chat tiếp tục gọi mô hình đúng cách',
                '✍️ Tiếp tục bỏ dấu Markdown/LaTeX thừa và khoảng trắng trước khi nhập đáp án'
            ]
        },        {
            version: '9.8.3',
            date: '2026',
            title: 'Làm sạch định dạng trước khi nhập đáp án',
            changes: [
                '✍️ Bỏ dấu Markdown/LaTeX còn sót như **J** trước khi đưa đáp án vào ô EduNext',
                '🧹 Chuẩn hoá khoảng trắng và dòng trống để phần nhập gọn, dễ đọc hơn'
            ]
        },
        {
            version: '9.8.2',
            date: '2026',
            title: 'Ưu tiên chia sẻ đúng tab EduNext và dừng sạch khi hoàn tất',
            changes: [
                '🧭 Đưa tab hiện tại lên ưu tiên trong hộp thoại chia sẻ và loại lựa chọn toàn màn hình khi trình duyệt hỗ trợ',
                '🔒 Từ chối luồng chia sẻ nếu trình duyệt báo đã chọn cửa sổ/toàn màn hình thay vì tab',
                '🛑 Khi kết thúc, dừng track, video và giải phóng ảnh đang giữ cùng Auto Chat'
            ]
        },
        {
            version: '9.8.1',
            date: '2026',
            title: 'Tự dừng Auto Chat và chia sẻ màn hình khi hoàn thành',
            changes: [
                '🏁 Nhận diện lời chúc mừng hoàn thành buổi học và dừng ngay, không chờ vòng làm thêm',
                '🛑 Tắt luồng chia sẻ màn hình cùng lúc với Auto Chat',
                '🔎 Ưu tiên thông báo hoàn thành để không nhầm phần tổng kết thành câu hỏi',
                '👁️ Nhận diện thông báo hoàn tất cả từ ảnh nếu EduNext chỉ vẽ nội dung lên canvas'
            ]
        },
        {
            version: '9.8.0',
            date: '2026',
            title: 'Tiếp tục xử lý câu mới sau khi trả lời Sẵn sàng',
            changes: [
                '🔁 Sau khi xác nhận Sẵn sàng, chủ động quét lại câu mới thay vì chờ observer',
                '🧭 Nhận diện thêm các cách hỏi xác nhận tiếp tục bằng tiếng Việt và tiếng Anh',
                '🔎 Dùng dấu nhận diện toàn bộ nội dung tin nhắn để tránh bỏ lỡ câu mới'
            ]
        },
        {
            version: '9.7.9',
            date: '2026',
            title: 'Xử lý câu hỏi mới từ ảnh và giữ ảnh rõ hơn',
            changes: [
                '👁️ Sau khi chụp màn hình, dùng ảnh để nhận diện câu hỏi ngay cả khi chữ DOM/canvas không đọc được',
                '🖼️ Tăng độ phân giải ảnh và gửi thêm vùng nội dung rõ hơn trên màn hình lớn',
                '🔁 So sánh toàn bộ tin nhắn để không bỏ qua câu mới có cùng phần mở đầu',
                '🔁 Bỏ qua an toàn ảnh mới nếu trong đó không có câu hỏi cần trả lời'
            ]
        },
        {
            version: '9.7.8',
            date: '2026',
            title: 'Tự bấm nút Sẵn sàng để chuyển phần học',
            changes: [
                '➡️ Khi EduNext hiện nút trả lời nhanh “Sẵn sàng”, tự bấm nút đó để tiếp tục bài học',
                '⌨️ Nếu không có nút trả lời nhanh, vẫn tự nhập và gửi câu trả lời như trước'
            ]
        },
        {
            version: '9.7.7',
            date: '2026',
            title: 'Ưu tiên câu hỏi EduNext hiện tại khi dùng ảnh màn hình',
            changes: [
                '🎯 Tự động gửi câu hỏi mới nhất cùng ảnh chụp làm ngữ cảnh',
                '🧹 Không để câu trả lời cũ “Sẵn sàng” lấn át nội dung bài tập'
            ]
        },
        {
            version: '9.7.6',
            date: '2026',
            title: 'Giữ một lần chia sẻ màn hình cho các câu hỏi mới',
            changes: [
                '🔁 Tái sử dụng luồng chia sẻ màn hình thay vì hỏi quyền lại cho từng lần chụp',
                '🤖 Khi Auto Chat đang bật, tự chụp màn hình khi phát hiện tin nhắn/câu hỏi mới',
                '🛑 Tắt Auto Chat sẽ dừng luồng chia sẻ màn hình'
            ]
        },
        {
            version: '9.7.3',
            date: '2026',
            title: 'Chụp một khung hình màn hình để hỏi model vision',
            changes: [
                '📸 Thêm nút chụp một lần qua quyền chia sẻ màn hình của trình duyệt',
                '🧹 Dừng chia sẻ ngay sau khi lấy ảnh và đính kèm ảnh cho yêu cầu AI kế tiếp'
            ]
        },
        {
            version: '9.6.0',
            date: '2026',
            title: 'Theo dõi chữ/ảnh canvas và gửi qua ô nhập hiện tại',
            changes: [
                '🧾 Theo dõi chữ được vẽ lên canvas ngay từ lúc trang tải',
                '🖼️ Ghi nhận URL ảnh nguồn trước khi canvas bị chặn đọc; thử lấy ảnh nguồn gửi cho model vision',
                '➡️ Tìm nút mũi tên gửi gần ô nhập; nhánh Ready gõ Sẵn sàng rồi gửi bằng nút đó'
            ]
        },
        {
            version: '9.5.9',
            date: '2026',
            title: 'Nới nhận diện nút gửi và dùng Enter dự phòng',
            changes: [
                '🔎 Nhận diện nút gửi qua nhãn, aria-label và title của EduNext',
                '⌨️ Health Check ghi nhận Enter dự phòng khi trang không có nút gửi đọc được'
            ]
        },
        {
            version: '9.5.7',
            date: '2026',
            title: 'Fix selector khung tin nhắn EduNext',
            changes: [
                '🎯 Luôn thử selector dự phòng để đọc tin nhắn AI, kể cả khi Self-healing đang tắt',
                '▶️ Giữ sửa xử lý câu hỏi đang hiển thị khi bật Auto Chat'
            ]
        },
        {
            version: '9.5.6',
            date: '2026',
            title: 'Fix bỏ qua tin nhắn hiện tại khi bật Auto Chat',
            changes: [
                '▶️ Khi bật hoặc bật lại, xử lý tin nhắn mới nhất thay vì đánh dấu sẵn là đã xử lý',
                '🔎 Giữ nhận diện câu hỏi học thuật trực tiếp từ bản 9.5.5'
            ]
        },
        {
            version: '9.5.5',
            date: '2026',
            title: 'Fix nhận diện câu hỏi học thuật trực tiếp',
            changes: [
                '🔎 Nhận diện câu hỏi có lệnh tính/giải và dữ kiện hoặc thuật ngữ môn học, kể cả khi thiếu mẫu Trả lời:',
                '🧠 Hỗ trợ dạng câu hỏi như bài Vật lý có số liệu và yêu cầu tính đại lượng'
            ]
        },
        {
            version: '9.5.4',
            date: '2026',
            title: 'Auto trả lời câu hỏi Tiếng Anh tự động + Credit FD',
            changes: [
                '🇬🇧 Tự động nhận diện và trả lời câu hỏi Tiếng Anh (Question / Answer: [your answer] / Please try the exercise below...)',
                '🧠 Tự động trả lời bằng Tiếng Anh và bỏ qua bộ lọc ép dịch Tiếng Việt khi gặp câu hỏi Tiếng Anh',
                '🔄 Hỗ trợ nhận diện thông báo sai / làm lại (try again, incorrect...) và kết thúc bài học bằng Tiếng Anh',
                '🇬🇧 Nhận diện prompt tiếng Anh "Are you ready..." trong bài học',
                '🔘 Thêm nút "Ready" / "Send" / "Gửi" / "Submit" vào bộ tìm nút nộp bài',
                '✅ Tự động gõ "Ready" thay vì "Sẵn sàng" khi gặp prompt tiếng Anh',
                "✨ Credit: FD | Tkhang/S0nL4m/Ph40c'/G14HU7/H^2"
            ]
        },
        {
            version: '9.5.3',
            date: '2026',
            title: 'Onboarding Tutorial cho người dùng mới',
            changes: [
                '📖 Wizard 6 bước — xuất hiện lần đầu mở tool, TRƯỚC khi hỏi API key',
                '🔑 Hướng dẫn lấy API key miễn phí (Groq/Gemini/OpenRouter) + trả phí',
                '➕ Hướng dẫn thêm key vào tool từng bước',
                '🎛️ Giới thiệu chi tiết từng nút trên thanh công cụ',
                '⚙️ Giới thiệu từng tab trong Settings',
                '🚀 Trang kết thúc — mẹo và phím tắt',
                '🎨 Nút 📖 riêng — mở lại hướng dẫn bất cứ lúc nào',
                '💡 Nút "Bỏ qua" và click × luôn chuyển sang bước thêm key tiếp theo'
            ]
        },
        {
            version: '9.5.2',
            date: '2026',
            title: 'Subject-aware AI — Văn / Anh / Kinh tế-Pháp luật',
            changes: [
                '📖 Môn Ngữ văn — prompt yêu cầu dẫn chứng tác phẩm, phân tích văn học, không markdown',
                '🇬🇧 Môn Tiếng Anh — prompt riêng cho dịch/viết lại câu/viết đoạn, output tiếng Anh khi cần',
                '⚖️ Môn Kinh tế và Pháp luật — trích điều khoản luật VN, thuật ngữ kinh tế chuẩn',
                '🧠 SUBJECT_KEYWORDS mở rộng mạnh cho 3 môn mới (Văn/Anh/KT-PL)',
                '🎯 buildSystemPrompt — block ngôn ngữ riêng cho môn Tiếng Anh',
                '🚫 Bỏ auto-retry tiếng Việt khi subject = english (tránh phá bản dịch)',
                '🔢 Loại Kinh tế-Pháp luật khỏi nhóm áp ký hiệu toán (tránh "căn", "nhân" trong văn luật)',
                '📝 SUBJECT_INSTRUCTIONS chi tiết hơn cho TẤT CẢ môn'
            ]
        },
        {
            version: '9.5.1',
            date: '2026',
            title: 'Key Validation + Strict Output Filter',
            changes: [
                '🔑 ensureValidKeys() — tự điền model mặc định nếu key rỗng',
                '🛡️ getActiveKey() — loại key thiếu model, fallback key khác',
                '📝 Form thêm key prefill model mặc định theo provider',
                '🧹 Sanitizer mạnh hơn — loại UUID, hex 20+ ký tự dính liền chữ',
                '🚫 Lọc "đã tăng tốc", "cache hit", "từ cache", "INT: ..."',
                '✨ Dòng cuối — bỏ dòng chỉ có dấu câu / rác',
                '⚠️ Settings cảnh báo "CHƯA CÓ MODEL" nếu key rỗng',
                '🐛 Fix bug copy report trong Health Dialog'
            ]
        },
        {
            version: '9.5.0',
            date: '2026',
            title: 'Clean Build — Remove Rest Mechanism',
            changes: [
                '🧹 Bỏ Realistic Idle Pauses (pause "đọc đề")',
                '🧹 Bỏ Time-of-Day Awareness (giới hạn giờ hoạt động)',
                '🧹 Bỏ Teacher Typing Detector (chờ GV ngừng gõ)',
                '🧹 Bỏ Human Presence Detection (chậm/dừng khi user vắng)',
                '🎭 Giữ Behavioral Fingerprint + Response Time Jitter',
                '🐛 Fix bug copy report trong Health Dialog (biến c.content)',
                '⚙️ Dọn dẹp profiles — bỏ các field đã ngưng dùng',
                '🚀 Đơn giản hoá preflight trong runAutoChat'
            ]
        },
        {
            version: '9.4.9',
            date: '2026',
            title: 'Stealth & Anti-Detection Suite',
            changes: [
                '🎭 Behavioral Fingerprint — cadence riêng cho mỗi session',
                '🎲 Response Time Jitter — biến thiên delay ngẫu nhiên',
                '🥷 5 preset mới: Ninja, Quick Stealth, Human, Night Owl, Paranoid',
                '⚙️ 4 preset cũ được nâng cấp với stealth features'
            ]
        }
    ];

    // ============================================================
    // PROVIDERS
    // ============================================================
    const PROVIDERS = {
        fpt_cloud: { label:'FPT StudyHub Cloud (Mã Hóa 100%)', emoji:'⚡',
            endpoint: 'http://localhost:8443/api/v1/ai/solve',
            format: 'fpt_proxy', authType: 'bearer',
            keyPattern: /^(TRIAL-|KEY-|PR-|DEMO-)/, keyHelp: 'http://localhost:8443', keyHint: 'TRIAL-EDUNEXT-2H-...',
            supportsVision: true,
            listEndpoint: null,
            freeInfo: 'Cloud AI Proxy: Toàn bộ API Key được bảo vệ & mã hóa trên máy chủ FPT Study Hub.',
            models: [
                { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Cloud AI Mã Hóa)', tier: 'free' },
                { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Cloud LPU Siêu Tốc)', tier: 'free' }
            ]
        },

        groq: { label:'Groq', emoji:'⚡',
            endpoint:'https://api.groq.com/openai/v1/chat/completions', format:'openai', authType:'bearer',
            keyPattern:/^gsk_/, keyHelp:'https://console.groq.com/keys', keyHint:'gsk_...',
            supportsVision: false,
            listEndpoint:'https://api.groq.com/openai/v1/models',
            freeInfo: 'Free tier: ~30 req/min, 14,400 req/day. Tất cả models đều FREE.',
            models:[
                { id:'openai/gpt-oss-20b', label:'GPT-OSS 20B', tier:'free' },
                { id:'openai/gpt-oss-120b', label:'GPT-OSS 120B', tier:'free' },
                { id:'llama-3.3-70b-versatile', label:'Llama 3.3 70B', tier:'free' },
                { id:'llama-3.1-8b-instant', label:'Llama 3.1 8B', tier:'free' },
                { id:'llama-3.1-70b-versatile', label:'Llama 3.1 70B', tier:'free' },
                { id:'mixtral-8x7b-32768', label:'Mixtral 8x7B', tier:'free' },
                { id:'gemma2-9b-it', label:'Gemma2 9B', tier:'free' },
                { id:'qwen-2.5-32b', label:'Qwen 2.5 32B', tier:'free' },
                { id:'qwen-2.5-coder-32b', label:'Qwen 2.5 Coder 32B', tier:'free' }
            ]
        },
        openai: { label:'OpenAI', emoji:'🤖',
            endpoint:'https://api.openai.com/v1/chat/completions', format:'openai', authType:'bearer',
            keyPattern:/^sk-/, keyHelp:'https://platform.openai.com/api-keys', keyHint:'sk-...',
            supportsVision: true,
            listEndpoint:'https://api.openai.com/v1/models',
            freeInfo: 'KHÔNG có free tier. Cần nạp credit ($5+). GPT-4o, GPT-4o-mini có vision.',
            models:[
                { id:'gpt-4o-mini', label:'GPT-4o Mini', tier:'paid' },
                { id:'gpt-4o', label:'GPT-4o', tier:'paid' },
                { id:'gpt-4-turbo', label:'GPT-4 Turbo', tier:'paid' },
                { id:'gpt-4', label:'GPT-4', tier:'paid' },
                { id:'gpt-3.5-turbo', label:'GPT-3.5 Turbo', tier:'paid' },
                { id:'o1-mini', label:'o1-mini', tier:'paid' },
                { id:'o1-preview', label:'o1-preview', tier:'paid' }
            ]
        },
        anthropic: { label:'Anthropic Claude', emoji:'🧠',
            endpoint:'https://api.anthropic.com/v1/messages', format:'anthropic', authType:'x-api-key',
            keyPattern:/^sk-ant-/, keyHelp:'https://console.anthropic.com/settings/keys', keyHint:'sk-ant-...',
            supportsVision: true,
            listEndpoint: null,
            freeInfo: 'KHÔNG có free tier. Cần nạp credit ($5+). Claude 3.5 Haiku rẻ nhất.',
            models:[
                { id:'claude-3-5-haiku-20241022', label:'Claude 3.5 Haiku', tier:'paid' },
                { id:'claude-3-5-sonnet-20241022', label:'Claude 3.5 Sonnet', tier:'paid' },
                { id:'claude-3-opus-20240229', label:'Claude 3 Opus', tier:'paid' },
                { id:'claude-3-sonnet-20240229', label:'Claude 3 Sonnet', tier:'paid' },
                { id:'claude-3-haiku-20240307', label:'Claude 3 Haiku', tier:'paid' }
            ]
        },
        google: { label:'Google Gemini', emoji:'✨',
            endpoint:'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            format:'gemini', authType:'query',
            keyPattern:/^AIza/, keyHelp:'https://aistudio.google.com/app/apikey', keyHint:'AIza...',
            supportsVision: true,
            listEndpoint:'https://generativelanguage.googleapis.com/v1beta/models',
            freeInfo: 'Free tier: 15 req/min, 1500 req/day. Flash models FREE + có vision.',
            models:[
                { id:'gemini-2.0-flash-exp', label:'Gemini 2.0 Flash Exp', tier:'free' },
                { id:'gemini-2.0-flash', label:'Gemini 2.0 Flash', tier:'free' },
                { id:'gemini-1.5-flash', label:'Gemini 1.5 Flash', tier:'free' },
                { id:'gemini-1.5-flash-8b', label:'Gemini 1.5 Flash 8B', tier:'free' },
                { id:'gemini-1.5-pro', label:'Gemini 1.5 Pro', tier:'freemium' }
            ]
        },
        openrouter: { label:'OpenRouter', emoji:'🌐',
            endpoint:'https://openrouter.ai/api/v1/chat/completions', format:'openai', authType:'bearer',
            keyPattern:/^sk-or-/, keyHelp:'https://openrouter.ai/keys', keyHint:'sk-or-...',
            supportsVision: true,
            listEndpoint:'https://openrouter.ai/api/v1/models',
            freeInfo: 'Free tier: ~50 req/day cho models có tag ":free". Deposit $10 → 1000/day.',
            models:[
                { id:'anthropic/claude-3.5-sonnet', label:'Claude 3.5 Sonnet', tier:'paid' },
                { id:'anthropic/claude-3.5-haiku', label:'Claude 3.5 Haiku', tier:'paid' },
                { id:'google/gemini-flash-1.5', label:'Gemini Flash 1.5', tier:'paid' },
                { id:'google/gemini-2.0-flash-exp:free', label:'Gemini 2.0 Flash (FREE)', tier:'free' },
                { id:'meta-llama/llama-3.3-70b-instruct', label:'Llama 3.3 70B', tier:'paid' },
                { id:'deepseek/deepseek-chat', label:'DeepSeek Chat', tier:'paid' },
                { id:'deepseek/deepseek-r1', label:'DeepSeek R1', tier:'paid' },
                { id:'openai/gpt-4o-mini', label:'GPT-4o Mini', tier:'paid' }
            ]
        },
        deepseek: { label:'DeepSeek', emoji:'🐋',
            endpoint:'https://api.deepseek.com/chat/completions', format:'openai', authType:'bearer',
            keyPattern:/^sk-/, keyHelp:'https://platform.deepseek.com/api_keys', keyHint:'sk-...',
            supportsVision: false,
            listEndpoint:'https://api.deepseek.com/models',
            freeInfo: 'KHÔNG có free tier, nhưng RẺ NHẤT thị trường (~$0.14/1M tokens).',
            models:[
                { id:'deepseek-chat', label:'DeepSeek Chat V3', tier:'paid' },
                { id:'deepseek-reasoner', label:'DeepSeek Reasoner R1', tier:'paid' }
            ]
        },
        custom: { label:'Custom (OpenAI-compatible)', emoji:'🔧',
            endpoint:'', format:'openai', authType:'bearer',
            keyPattern:null, keyHelp:'Ollama: http://localhost:11434/v1/chat/completions', keyHint:'any',
            supportsVision: false,
            listEndpoint: null,
            freeInfo: 'Local models (Ollama/LM Studio) — miễn phí 100%, không cần internet.',
            models:[
                { id:'llama3.2', label:'llama3.2', tier:'free' },
                { id:'llama3.1', label:'llama3.1', tier:'free' },
                { id:'qwen2.5', label:'qwen2.5', tier:'free' },
                { id:'mistral', label:'mistral', tier:'free' },
                { id:'phi3', label:'phi3', tier:'free' }
            ]
        }
    };

    // ============================================================
    // MODEL PRICING
    // ============================================================
    const MODEL_PRICING = [
        { match: /gpt-oss-20b/i, input: 0, output: 0, label: 'Groq GPT-OSS 20B' },
        { match: /gpt-oss-120b/i, input: 0, output: 0, label: 'Groq GPT-OSS 120B' },
        { match: /llama-3\.3-70b/i, input: 0.59, output: 0.79, label: 'Groq Llama 3.3 70B' },
        { match: /llama-3\.1-8b/i, input: 0.05, output: 0.08, label: 'Groq Llama 3.1 8B' },
        { match: /llama-3\.1-70b/i, input: 0.59, output: 0.79, label: 'Groq Llama 3.1 70B' },
        { match: /mixtral-8x7b/i, input: 0.24, output: 0.24, label: 'Groq Mixtral 8x7B' },
        { match: /gemma2-9b/i, input: 0.20, output: 0.20, label: 'Groq Gemma2 9B' },
        { match: /qwen-2\.5-32b/i, input: 0.79, output: 0.79, label: 'Groq Qwen 2.5 32B' },
        { match: /^gpt-4o-mini$/, input: 0.15, output: 0.60, label: 'GPT-4o Mini' },
        { match: /^gpt-4o$/, input: 2.50, output: 10.00, label: 'GPT-4o' },
        { match: /gpt-4-turbo/, input: 10.00, output: 30.00, label: 'GPT-4 Turbo' },
        { match: /^gpt-4$/, input: 30.00, output: 60.00, label: 'GPT-4' },
        { match: /gpt-3\.5-turbo/, input: 0.50, output: 1.50, label: 'GPT-3.5 Turbo' },
        { match: /^o1-mini$/, input: 3.00, output: 12.00, label: 'o1-mini' },
        { match: /^o1-preview$/, input: 15.00, output: 60.00, label: 'o1-preview' },
        { match: /claude-3-5-sonnet/, input: 3.00, output: 15.00, label: 'Claude 3.5 Sonnet' },
        { match: /claude-3-5-haiku/, input: 0.80, output: 4.00, label: 'Claude 3.5 Haiku' },
        { match: /claude-3-opus/, input: 15.00, output: 75.00, label: 'Claude 3 Opus' },
        { match: /claude-3-sonnet/, input: 3.00, output: 15.00, label: 'Claude 3 Sonnet' },
        { match: /claude-3-haiku/, input: 0.25, output: 1.25, label: 'Claude 3 Haiku' },
        { match: /gemini-2\.0-flash/i, input: 0.10, output: 0.40, label: 'Gemini 2.0 Flash' },
        { match: /gemini-1\.5-flash-8b/i, input: 0.0375, output: 0.15, label: 'Gemini 1.5 Flash 8B' },
        { match: /gemini-1\.5-flash/i, input: 0.075, output: 0.30, label: 'Gemini 1.5 Flash' },
        { match: /gemini-1\.5-pro/i, input: 1.25, output: 5.00, label: 'Gemini 1.5 Pro' },
        { match: /deepseek-chat/i, input: 0.14, output: 0.28, label: 'DeepSeek Chat' },
        { match: /deepseek-reasoner/i, input: 0.55, output: 2.19, label: 'DeepSeek Reasoner' },
        { match: /openai\/gpt-4o-mini/i, input: 0.15, output: 0.60, label: 'GPT-4o Mini (OR)' },
        { match: /anthropic\/claude-3\.5-sonnet/i, input: 3.00, output: 15.00, label: 'Claude 3.5 Sonnet (OR)' },
        { match: /anthropic\/claude-3\.5-haiku/i, input: 0.80, output: 4.00, label: 'Claude 3.5 Haiku (OR)' },
        { match: /google\/gemini-flash-1\.5/i, input: 0.075, output: 0.30, label: 'Gemini Flash 1.5 (OR)' },
        { match: /google\/gemini-2\.0-flash/i, input: 0.10, output: 0.40, label: 'Gemini 2.0 Flash (OR)' },
        { match: /meta-llama\/llama-3\.3-70b/i, input: 0.23, output: 0.40, label: 'Llama 3.3 70B (OR)' },
        { match: /deepseek\/deepseek-chat/i, input: 0.14, output: 0.28, label: 'DeepSeek Chat (OR)' },
        { match: /deepseek\/deepseek-r1/i, input: 0.55, output: 2.19, label: 'DeepSeek R1 (OR)' }
    ];
    function getPricing(model) {
        if (!model) return { input: 0, output: 0, label: 'Unknown' };
        for (const p of MODEL_PRICING) if (p.match.test(model)) return p;
        return { input: 0, output: 0, label: model };
    }
    function estimateCost(model, tokensIn, tokensOut) {
        const p = getPricing(model);
        return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
    }

    let buttonsHidden = false;

    // ============================================================
    // FREE MODEL TRACKER
    // ============================================================
    const FREE_MODELS_CACHE_KEY = 'auto_chat_free_models_v2';
    const FREE_MODELS_TTL_MS = 24 * 60 * 60 * 1000;
    let FREE_MODELS_CACHE = null;
    let FREE_MODELS_FETCHING = false;

    function classifyModelTier(providerId, modelId, rawModel) {
        const mid = (modelId || '').toLowerCase();
        const pid = (providerId || '').toLowerCase();
        if (mid.includes(':free') || mid.endsWith(':free')) return 'free';
        if (pid === 'groq') return 'free';
        if (pid === 'custom') return 'free';
        if (pid === 'google') {
            if (/gemini-(1\.5|2\.0)-flash/.test(mid)) return 'free';
            if (/gemini-.*-pro/.test(mid)) return 'freemium';
            return 'free';
        }
        if (pid === 'openrouter') {
            if (rawModel && rawModel.pricing) {
                const p = rawModel.pricing;
                const promptPrice = parseFloat(p.prompt || '0');
                const completionPrice = parseFloat(p.completion || '0');
                if (promptPrice === 0 && completionPrice === 0) return 'free';
            }
            return 'paid';
        }
        if (pid === 'openai' || pid === 'anthropic' || pid === 'deepseek') return 'paid';
        return 'paid';
    }

    function fetchProviderModels(providerId) {
        return new Promise((resolve) => {
            const provider = PROVIDERS[providerId];
            if (!provider) { resolve({ models: [], error: 'Unknown provider', source: 'none', fetchedAt: Date.now() }); return; }

            const keys = (SETTINGS.keys || []).filter(k => k.enabled !== false && k.provider === providerId);
            const keyEntry = keys[0] || null;

            const staticList = () => (provider.models || []).map(m => ({
                id: m.id,
                label: m.label || m.id,
                tier: m.tier || classifyModelTier(providerId, m.id),
                vision: /claude-3|gpt-4o|gpt-4-turbo|gpt-4-vision|gemini-(1\.5|2\.0)|llava|pixtral|vision/i.test(m.id)
            }));

            if (!provider.listEndpoint) {
                resolve({ models: staticList(), error: null, source: 'static', fetchedAt: Date.now() });
                return;
            }

            const isPublicEndpoint = providerId === 'openrouter';
            if (!isPublicEndpoint && !keyEntry) {
                resolve({ models: staticList(), error: 'Chưa có key — hiển thị danh sách tĩnh', source: 'static', fetchedAt: Date.now() });
                return;
            }

            let url = provider.listEndpoint;
            const headers = {};
            if (providerId === 'google') {
                url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(keyEntry.key);
            } else if (providerId === 'openrouter') {
                headers['HTTP-Referer'] = 'https://fsc-edunext.fpt.edu.vn/';
                headers['X-Title'] = 'FPT EduNext Auto Chat';
            } else {
                if (keyEntry && keyEntry.key && keyEntry.key !== 'none') headers['Authorization'] = 'Bearer ' + keyEntry.key;
                if (providerId === 'anthropic' && keyEntry) {
                    headers['x-api-key'] = keyEntry.key;
                    headers['anthropic-version'] = '2023-06-01';
                }
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers,
                timeout: 15000,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        let rawModels = [];
                        if (providerId === 'google' && data.models) {
                            rawModels = data.models.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
                        } else if (data.data) {
                            rawModels = data.data;
                        } else if (Array.isArray(data)) {
                            rawModels = data;
                        }
                        const list = rawModels.map(m => {
                            let id = m.id || m.name || '';
                            if (providerId === 'google') id = id.replace('models/', '');
                            if (/embed|whisper|dall-e|tts|moderation|davinci|babbage|ada|curie/i.test(id)) return null;
                            const tier = classifyModelTier(providerId, id, m);
                            const vision = /vision|gpt-4o|gpt-4-turbo|claude-3|gemini-(1\.5|2\.0)|llava|pixtral/i.test(id);
                            return { id, label: id, tier, vision };
                        }).filter(Boolean);
                        resolve({ models: list, error: null, source: 'live', fetchedAt: Date.now() });
                    } catch (e) {
                        resolve({ models: staticList(), error: 'Parse: ' + e.message, source: 'static', fetchedAt: Date.now() });
                    }
                },
                onerror: () => resolve({ models: staticList(), error: 'Network error', source: 'static', fetchedAt: Date.now() }),
                ontimeout: () => resolve({ models: staticList(), error: 'Timeout', source: 'static', fetchedAt: Date.now() })
            });
        });
    }

    async function refreshFreeModelsCache(force = false) {
        if (FREE_MODELS_FETCHING) return FREE_MODELS_CACHE;
        if (!force) {
            const cached = getFreeModelsCache();
            if (cached) return cached;
        }
        FREE_MODELS_FETCHING = true;
        const result = {};
        const allProviders = Object.keys(PROVIDERS);
        for (const pid of allProviders) {
            try {
                result[pid] = await fetchProviderModels(pid);
            } catch (e) {
                result[pid] = { models: [], error: e.message, source: 'none', fetchedAt: Date.now() };
            }
        }
        FREE_MODELS_CACHE = { timestamp: Date.now(), data: result };
        try { GM_setValue(FREE_MODELS_CACHE_KEY, JSON.stringify(FREE_MODELS_CACHE)); } catch (e) {}
        FREE_MODELS_FETCHING = false;
        console.log('%c[Auto Chat] Đã refresh Free Model Cache (ALL providers)', 'color:#10b981;font-weight:bold;',
            Object.fromEntries(Object.entries(result).map(([k, v]) => [k, `${v.models.length} models (${v.source})`])));
        return FREE_MODELS_CACHE;
    }

    function getFreeModelsCache() {
        if (FREE_MODELS_CACHE) {
            if (Date.now() - FREE_MODELS_CACHE.timestamp <= FREE_MODELS_TTL_MS) return FREE_MODELS_CACHE;
        }
        try {
            const raw = GM_getValue(FREE_MODELS_CACHE_KEY, '');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Date.now() - parsed.timestamp > FREE_MODELS_TTL_MS) return null;
            FREE_MODELS_CACHE = parsed;
            return parsed;
        } catch (e) { return null; }
    }

    // ============================================================
    // SESSION STATS
    // ============================================================
    let sessionStats = {
        startTime: Date.now(), calls: 0, tokensIn: 0, tokensOut: 0, cost: 0,
        byModel: {}, questions: 0, retries: 0,
        cacheHits: 0, cacheMisses: 0, savedTokens: 0, savedCost: 0,
        imageScans: 0, routerSwitches: 0,
        failedQuestions: []
    };
    function resetSessionStats() {
        sessionStats = {
            startTime: Date.now(), calls: 0, tokensIn: 0, tokensOut: 0, cost: 0,
            byModel: {}, questions: 0, retries: 0,
            cacheHits: 0, cacheMisses: 0, savedTokens: 0, savedCost: 0,
            imageScans: 0, routerSwitches: 0, failedQuestions: []
        };
    }
    function recordUsage(model, tokensIn, tokensOut) {
        const cost = estimateCost(model, tokensIn, tokensOut);
        sessionStats.calls++;
        sessionStats.tokensIn += tokensIn;
        sessionStats.tokensOut += tokensOut;
        sessionStats.cost += cost;
        if (!sessionStats.byModel[model]) sessionStats.byModel[model] = { calls: 0, tokensIn: 0, tokensOut: 0, cost: 0, label: getPricing(model).label };
        const m = sessionStats.byModel[model];
        m.calls++; m.tokensIn += tokensIn; m.tokensOut += tokensOut; m.cost += cost;
    }

    // ============================================================
    // DEFAULT SETTINGS
    // ============================================================
    const DEFAULT_SETTINGS = {
        autoSubmit: 'on',
        speed: 'normal', smartness: 'balanced', responseLength: 'normal',
        waitBeforeSend: 'off', autoType: 'off', recheckMode: 'off', failRetryMode: 'normal',
        filterIds: 'on', stripReplyPrefix: 'on', slangRate: 'off', mistakeRate: 'off',
        diacriticRate: 'off', notation: 'symbols', chemNotation: 'symbols', physicsNotation: 'symbols',
        forceVietnamese: 'on', vietnameseStrictness: 'normal',
        cacheEnabled: 'on', cacheFuzzy: 'on', cacheTTL: 7, cacheMax: 500, cacheMinConfidence: 6, cacheShowHit: 'on',
        ensembleEnabled: 'off', ensembleCount: 'three', ensembleStrategy: 'majority',
        ensembleMode: 'single', routerEnabled: 'off',
        imageSupport: 'on', imageAutoRoute: 'on',
        activityPanelOpen: 'off', activityToasts: 'off',
        freeModelsAutoRefresh: 'on',
        hideKeybind: "'", autoChatKeybind: '', customPrompt: '',
        autoDisableAfterFailures: 'off', justOneMore: 'off',
        questionTypeDetection: 'off', humanTouch: 'off', fatigueCurve: 'off',
        duplicateGuard: 'on', toasts: 'on', failureNotification: 'toast',
        confidenceEnabled: 'off', confidenceThreshold: 7, confidenceAction: 'recheck',
        subjectDetection: 'off', readyAutoEnter: 'normal',
        selfHealingEnabled: 'off', domHealthEnabled: 'off', domHealthInterval: 30, selectorLogLevel: 'warn',
        behavioralFingerprint: 'off', responseTimeJitter: 'off',
        lastSeenVersion: '', tutorialSeen: 'off', keys: [{ id: 'k_fpt_trial', provider: 'fpt_cloud', model: 'gemini-2.5-flash', name: '⚡ FPT Cloud AI (Mã Hóa 100%)', key: 'TRIAL-EDUNEXT-2H-AUTO', enabled: true }], activeKeyId: 'k_fpt_trial'
    };

    // ============================================================
    // PRESETS
    // ============================================================
    const AUTO_SUBMIT_PRESETS = {
        on:  { label:'🚀 Tự động gửi', desc:'Điền xong tự bấm Nộp / Enter' },
        off: { label:'📝 Chỉ điền nháp', desc:'Chỉ điền vào ô để bạn tự xem và gửi' }
    };
    const isAutoSubmitOn = () => SETTINGS.autoSubmit !== 'off';

    const SPEED_PRESETS = {
        very_slow: { label:'🐌 Rất chậm', desc:'Siêu an toàn', PROCESSING_TIMEOUT:300000, WAIT_RESPONSE_MAX:120000, WAIT_RESPONSE_INTERVAL:5000, POLL_SUBMIT_MAX:20000, POLL_SUBMIT_INTERVAL:1000, OBSERVER_DEBOUNCE:3500, TYPING_DELAY:4000, INTERVAL_CHECK:25000 },
        slow: { label:'🐢 Chậm', desc:'Chờ lâu', PROCESSING_TIMEOUT:180000, WAIT_RESPONSE_MAX:60000, WAIT_RESPONSE_INTERVAL:3000, POLL_SUBMIT_MAX:12000, POLL_SUBMIT_INTERVAL:600, OBSERVER_DEBOUNCE:2000, TYPING_DELAY:2000, INTERVAL_CHECK:15000 },
        normal: { label:'⚡ Bình thường', desc:'Cân bằng', PROCESSING_TIMEOUT:120000, WAIT_RESPONSE_MAX:40000, WAIT_RESPONSE_INTERVAL:2000, POLL_SUBMIT_MAX:8000, POLL_SUBMIT_INTERVAL:400, OBSERVER_DEBOUNCE:1200, TYPING_DELAY:1200, INTERVAL_CHECK:5000 },
        fast: { label:'🚀 Nhanh', desc:'Nhanh', PROCESSING_TIMEOUT:60000, WAIT_RESPONSE_MAX:25000, WAIT_RESPONSE_INTERVAL:1000, POLL_SUBMIT_MAX:5000, POLL_SUBMIT_INTERVAL:200, OBSERVER_DEBOUNCE:600, TYPING_DELAY:600, INTERVAL_CHECK:5000 },
        very_fast: { label:'⚡⚡ Cực nhanh', desc:'Tối đa', PROCESSING_TIMEOUT:30000, WAIT_RESPONSE_MAX:15000, WAIT_RESPONSE_INTERVAL:500, POLL_SUBMIT_MAX:3000, POLL_SUBMIT_INTERVAL:100, OBSERVER_DEBOUNCE:250, TYPING_DELAY:200, INTERVAL_CHECK:2500 }
    };
    const SMARTNESS_PRESETS = {
        fast: { label:'⚡ Nhanh', desc:'Ít token', max_tokens:1024, retry:1, temperature:0.3 },
        balanced: { label:'⚖️ Cân bằng', desc:'Cân bằng', max_tokens:2048, retry:2, temperature:0.4 },
        smart: { label:'🧠 Thông minh', desc:'Nhiều token', max_tokens:3072, retry:2, temperature:0.3 },
        genius: { label:'🎓 Thiên tài', desc:'Tối đa', max_tokens:4096, retry:3, temperature:0.2 }
    };
    const RESPONSE_LENGTH_PRESETS = {
        short: { label:'📏 Ngắn', desc:'Chỉ đáp án', instruction:'TRẢ LỜI CỰC NGẮN GỌN.', maxTokensMultiplier:0.35 },
        normal: { label:'📐 Bình thường', desc:'Cân bằng', instruction:'', maxTokensMultiplier:1.0 },
        long: { label:'📜 Dài', desc:'Chi tiết', instruction:'TRẢ LỜI CHI TIẾT.', maxTokensMultiplier:1.6 }
    };
    const WAIT_BEFORE_SEND_PRESETS = {
        off:{label:'🚫 Tắt',desc:'Gửi ngay',min:0,max:0},
        short:{label:'⏱️ Ngắn (1-3s)',desc:'Dừng chút',min:1000,max:3000},
        normal:{label:'⏸️ Bình thường (3-8s)',desc:'Như đọc lại',min:3000,max:8000},
        long:{label:'⏳ Dài (8-15s)',desc:'Như suy nghĩ',min:8000,max:15000},
        very_long:{label:'🕰️ Rất dài (15-30s)',desc:'Như tính',min:15000,max:30000},
        random:{label:'🎲 Ngẫu nhiên',desc:'0-20s',min:0,max:20000}
    };
    const AUTO_TYPE_MAX_DURATION_MS = 60000;
    const AUTO_TYPE_PRESETS = {
        off:{label:'🚫 Tắt',desc:'Dán tức thì',mode:'off',delay:0,jitter:0,humanPauses:false},
        fast:{label:'⚡ Nhanh (~20ms)',desc:'Gõ nhanh',mode:'progressive',delay:20,jitter:10,humanPauses:false},
        normal:{label:'⌨️ Bình thường (~50ms)',desc:'Vừa',mode:'progressive',delay:50,jitter:25,humanPauses:false},
        slow:{label:'🐢 Chậm (~100ms)',desc:'Từ tốn',mode:'progressive',delay:100,jitter:50,humanPauses:false},
        human:{label:'🎭 Giống người',desc:'Delay + dừng',mode:'progressive',delay:80,jitter:70,humanPauses:true}
    };
    const READY_AUTO_ENTER_PRESETS = {
        off: { label:'🚫 Tắt', desc:'Không auto retry', checkDelay:0, maxAttempts:0 },
        short: { label:'⏱️ Nhanh (3s)', desc:'Chờ 3s, thử 2 lần', checkDelay:3000, maxAttempts:2 },
        normal: { label:'⏸️ Bình thường (5s)', desc:'Chờ 5s, thử 3 lần', checkDelay:5000, maxAttempts:3 },
        long: { label:'⏳ Dài (10s)', desc:'Chờ 10s, thử 5 lần', checkDelay:10000, maxAttempts:5 }
    };
    const FORCE_VIETNAMESE_PRESETS = { on: { label:'🇻🇳 Bắt buộc', desc:'Luôn tiếng Việt' }, off: { label:'🌐 Tự do', desc:'Theo đề' } };
    const VIETNAMESE_STRICTNESS_PRESETS = { off: { label:'🚫 Tắt', desc:'Không kiểm tra' }, normal: { label:'⚖️ Bình thường (1 lần)', desc:'Retry 1 lần' }, strict: { label:'🔬 Nghiêm (2 lần)', desc:'Retry 2 lần' } };
    const ENSEMBLE_MODE_PRESETS = { single: { label:'🔁 Cùng model', desc:'1 model chạy N lần' }, multi: { label:'🎯 Đa model', desc:'N model khác nhau' } };

    const BEHAVIORAL_FINGERPRINT_PRESETS = {
        off: { label:'🚫 Tắt', desc:'Delay cố định như cũ' },
        on:  { label:'🎭 Bật', desc:'Random hệ số 1 lần, giữ nguyên cả session' }
    };
    const RESPONSE_JITTER_PRESETS = {
        off:    { label:'🚫 Tắt',         desc:'Delay cố định',                factor:0,    minMs:0 },
        light:  { label:'🍃 Nhẹ (±15%)',   desc:'Biến thiên nhỏ',               factor:0.15, minMs:10 },
        medium: { label:'⚖️ Vừa (±30%)',   desc:'Biến thiên rõ',                factor:0.30, minMs:10 },
        heavy:  { label:'🎲 Mạnh (±50%)',  desc:'Không lần nào trùng lần nào',  factor:0.50, minMs:5 }
    };

    const RECHECK_PRESETS = { off:{label:'🚫 Tắt',desc:'Nộp thẳng',maxPasses:0,temp:0.1}, light:{label:'🔍 Nhẹ (1 lần)',desc:'Kiểm tra 1 lần',maxPasses:1,temp:0.1}, strict:{label:'🔬 Nghiêm (2 lần)',desc:'Tối đa 2 lần',maxPasses:2,temp:0.05} };
    const RECHECK_SYSTEM_PROMPT = 'Bạn là giáo viên chấm bài nghiêm khắc. Được cho ĐỀ BÀI và ĐÁP ÁN. Xác định ĐÚNG hay SAI. CHỈ trả lời:\nVERDICT: CORRECT\nhoặc\nVERDICT: WRONG\nCORRECTED: <đáp án đúng>\n\n';
    const FAIL_RETRY_PRESETS = { off:{label:'🚫 Tắt',desc:'Không retry',maxAttempts:0,baseDelay:0,backoffFactor:1}, normal:{label:'🔁 Bình thường (3)',desc:'Thử 3 lần',maxAttempts:3,baseDelay:3000,backoffFactor:1.5}, aggressive:{label:'🔁🔁 Mạnh (6)',desc:'Thử 6 lần',maxAttempts:6,baseDelay:2000,backoffFactor:2}, infinite:{label:'♾️ Vô hạn',desc:'Thử mãi',maxAttempts:999,baseDelay:3000,backoffFactor:1.5} };
    const FILTER_ID_PRESETS = { on:{label:'🧹 Bật',desc:'Lọc ID/UI'}, off:{label:'🚫 Tắt',desc:'Giữ nguyên'} };
    const STRIP_PREFIX_PRESETS = { on:{label:'✂️ Bật',desc:'Bỏ prefix'}, off:{label:'🚫 Tắt',desc:'Giữ prefix'} };
    const ON_OFF_PRESETS = { on:{label:'✅ Bật',desc:'Đang hoạt động'}, off:{label:'🚫 Tắt',desc:'Không dùng'} };
    const CACHE_TTL_PRESETS = { 1:{label:'1 ngày',desc:'Ngắn'}, 3:{label:'3 ngày',desc:'Vừa'}, 7:{label:'7 ngày',desc:'Mặc định'}, 30:{label:'30 ngày',desc:'Dài'}, 365:{label:'1 năm',desc:'Vĩnh viễn'} };
    const CACHE_MAX_PRESETS = { 100:{label:'100 entries',desc:'Nhẹ'}, 500:{label:'500 entries',desc:'Mặc định'}, 1000:{label:'1000 entries',desc:'Nhiều'}, 5000:{label:'5000 entries',desc:'Rất nhiều'} };
    const AUTO_DISABLE_PRESETS = { off:{label:'🚫 Tắt',desc:'Không tự dừng',threshold:0}, three:{label:'3 lần',desc:'Dừng sau 3 câu sai',threshold:3}, five:{label:'5 lần',desc:'Dừng sau 5 câu sai',threshold:5}, ten:{label:'10 lần',desc:'Dừng sau 10 câu sai',threshold:10} };
    const JUST_ONE_MORE_PRESETS = { off:{label:'🚫 Tắt',desc:'Dừng ngay',waitMs:0}, short:{label:'⏱️ Ngắn (3s)',desc:'Chờ 3s',waitMs:3000}, normal:{label:'⏸️ Bình thường (6s)',desc:'Chờ 6s',waitMs:6000}, long:{label:'⏳ Dài (10s)',desc:'Chờ 10s',waitMs:10000} };
    const FAILURE_NOTIF_PRESETS = { off:{label:'🚫 Tắt',desc:'Không thông báo'}, toast:{label:'🍞 Toast',desc:'Trong trang'}, desktop:{label:'🖥️ Desktop',desc:'Hệ điều hành'}, both:{label:'🔔 Cả hai',desc:'Toast + Desktop'} };
    const CONFIDENCE_ACTION_PRESETS = { recheck: { label:'🔍 Chạy recheck', desc:'Tự kiểm tra lại' }, pause: { label:'⏸️ Tạm dừng', desc:'Dừng để xem' } };
    const ENSEMBLE_COUNT_PRESETS = { three:{label:'3 lần',desc:'Cân bằng'}, five:{label:'5 lần',desc:'Chậm hơn, chính xác hơn'} };
    const ENSEMBLE_STRATEGY_PRESETS = { majority: { label:'🗳️ Đa số', desc:'Đáp án nhiều phiếu nhất' }, unanimous: { label:'🤝 Đồng thuận', desc:'Tất cả đồng ý' }, pause: { label:'⏸️ Tạm dừng khi chia rẽ', desc:'Khác biệt → dừng' } };
    const STATUS_STATES = {
        idle: { icon:'💤', color:'#94a3b8', label:'Idle' },
        cached: { icon:'⚡', color:'#f59e0b', label:'Cache hit', pulse:true },
        thinking: { icon:'🧠', color:'#6366f1', label:'Đang suy nghĩ...', pulse:true },
        imaging: { icon:'🖼️', color:'#c026d3', label:'Đang đọc ảnh...', pulse:true },
        typing: { icon:'✍️', color:'#7c3aed', label:'Đang gõ...', pulse:true },
        submitting: { icon:'📤', color:'#0891b2', label:'Đang nộp...', pulse:true },
        waiting: { icon:'⏳', color:'#f59e0b', label:'Chờ phản hồi...', pulse:true },
        done: { icon:'✅', color:'#059669', label:'Hoàn thành' },
        failed: { icon:'❌', color:'#dc2626', label:'Lỗi' }
    };

    // ============================================================
    // SUBJECT DETECTION
    // ============================================================
    const SUBJECT_EMOJI = {
        chemistry:'🧪', math:'📐', physics:'⚛️',
        literature:'📖', english:'🇬🇧', economics:'⚖️',
        code:'💻', generic:'🎯'
    };

    const SUBJECT_INSTRUCTIONS = {
        chemistry: '[MÔN HOÁ HỌC] Kiểm tra cân bằng phương trình, ghi rõ trạng thái (rắn/lỏng/khí/dung dịch). Đơn vị chuẩn: mol, M, g, mL, lít. Dùng → cho phản ứng một chiều, ⇌ cho phản ứng thuận nghịch. Ghi rõ điều kiện phản ứng (nhiệt độ, xúc tác) khi cần.',

        math: '[MÔN TOÁN] Trình bày lời giải theo từng bước rõ ràng. Nêu công thức áp dụng trước khi thay số. Kiểm tra đơn vị và làm tròn hợp lý. Kết quả cuối cùng phải nổi bật, có thể đóng khung hoặc in đậm.',

        physics: '[MÔN VẬT LÝ] Ghi công thức gốc → thay số → kết quả kèm đơn vị SI. Nêu rõ đại lượng và đơn vị. Với bài tập định tính: giải thích hiện tượng dựa trên định luật vật lý. Với bài tập định lượng: trình bày từng bước tính toán.',

        literature: '[MÔN NGỮ VĂN] Trả lời có DẪN CHỨNG cụ thể từ tác phẩm (tên tác giả, tác phẩm, chi tiết, hình ảnh, câu thơ). Phân tích theo trình tự: giới thiệu → phân tích → đánh giá. Dùng ngôn ngữ văn học tự nhiên, biểu cảm, tránh khô khan. Với nghị luận xã hội: nêu vấn đề → phân tích → bình luận → liên hệ bản thân. Với phân tích thơ: nêu nội dung → nghệ thuật → giá trị. KHÔNG dùng ký hiệu toán/lý/hoá. KHÔNG markdown, không LaTeX.',

        english: '[MÔN TIẾNG ANH] Đây là môn Tiếng Anh.\n• Nếu đề yêu cầu DỊCH (Việt↔Anh): output phải là bản dịch hoàn chỉnh, đúng ngữ pháp tự nhiên.\n• Nếu đề yêu cầu VIẾT LẠI CÂU: giữ nguyên nghĩa, output là câu tiếng Anh mới.\n• Nếu đề là ĐỌC HIỂU: trả lời ngắn gọn, có thể tiếng Anh hoặc tiếng Việt tuỳ đề.\n• Nếu đề là NGỮ PHÁP/TỪ VỰNG: nêu đáp án + giải thích NGẮN GỌN bằng tiếng Việt.\n• Nếu đề yêu cầu VIẾT ĐOẠN VĂN tiếng Anh: viết đủ số từ, đúng chủ đề, đúng ngữ pháp.\nKHÔNG markdown, không LaTeX. Giữ nguyên thuật ngữ chuyên môn tiếng Anh.',

        economics: '[MÔN KINH TẾ VÀ PHÁP LUẬT]\n• Với câu hỏi PHÁP LUẬT: trả lời dựa trên quy định pháp luật Việt Nam hiện hành. Trích dẫn điều khoản luật cụ thể khi biết (ví dụ: "Theo Điều X Luật Y"). Phân biệt rõ: vi phạm hành chính / hình sự / dân sự / kỷ luật. Nêu rõ chủ thể, hành vi, hậu quả pháp lý, biện pháp xử lý.\n• Với câu hỏi KINH TẾ: dùng thuật ngữ chuẩn (cung - cầu, lạm phát, GDP, GNI, thất nghiệp, cán cân thanh toán,...). Phân tích có ví dụ minh hoạ thực tế khi cần.\n• Với câu hỏi TÌNH HUỐNG: phân tích tình huống → xác định vấn đề → đưa ra giải pháp.\nTrả lời rõ ràng, có căn cứ. KHÔNG markdown, không LaTeX.',

        code: '[MÔN TIN HỌC] Được phép dùng code block. Giải thích thuật toán ngắn gọn trước khi code. Nêu độ phức tạp nếu liên quan. Comment code khi cần thiết.',

        generic: ''
    };

    const SUBJECT_KEYWORDS = {
        chemistry: [
            /\b(axit|bazơ|muối|kết tủa|dung dịch)\b/gi,
            /\b(mol|nồng độ|pH|pOH)\b/gi,
            /\b(phản ứng|hoá trị|oxi hoá|khử|điện li)\b/gi,
            /\b(H₂O|H2O|CO₂|CO2|NaCl|H₂SO₄|H2SO4|NaOH|HCl|HNO₃|HNO3|NH3|NH₄|SO₄|CO₃)\b/g,
            /[A-Z][a-z]?\d*[⁺⁻]/g
        ],
        math: [
            /\b(phương trình|bất phương trình|hệ phương trình)\b/gi,
            /\b(đạo hàm|tích phân|giới hạn|logarit|lượng giác)\b/gi,
            /\b(tam giác|đường tròn|hình học|vector|toạ độ)\b/gi,
            /\b(sin|cos|tan|cot|lim|∫|∑|√|π)\b/g,
            /\b(x²|x³|x\^|f\(x\)|y\s*=)\b/gi
        ],
        physics: [
            /\b(vận tốc|gia tốc|quãng đường|chuyển động)\b/gi,
            /\b(lực|momen|động lượng|động năng|thế năng|cơ năng)\b/gi,
            /\b(điện trở|cường độ dòng điện|hiệu điện thế|công suất điện)\b/gi,
            /\b(dao động|sóng|tần số|chu kỳ|bước sóng)\b/gi,
            /[ωαβγδεζηθικλμνξπρστυφχψΩΔ]/g
        ],
        literature: [
            /\b(phân tích|nghị luận|cảm nhận|bình luận|chứng minh|thuyết minh|tự sự|miêu tả|biểu cảm)\b/gi,
            /\b(tác phẩm|tác giả|nhân vật|đoạn trích|bài thơ|truyện ngắn|tiểu thuyết|tuỳ bút|ký|ca dao|tục ngữ)\b/gi,
            /\b(hình ảnh|biện pháp tu từ|ẩn dụ|nhân hoá|so sánh|hoán dụ|nói quá|điệp ngữ|đảo ngữ|liệt kê)\b/gi,
            /\b(mở bài|thân bài|kết bài|dẫn chứng|luận điểm|luận cứ|ý nghĩa|giá trị nội dung|giá trị nghệ thuật)\b/gi,
            /\b(cảm xúc|tâm trạng|tình cảm|số phận|thân phận|khát vọng|phẩm chất|vẻ đẹp)\b/gi
        ],
        english: [
            /\b(translate|translation|dịch|rewrite|viết lại câu)\b/gi,
            /\b(grammar|tense|passive voice|active voice|conditional|relative clause|reported speech)\b/gi,
            /\b(vocabulary|synonym|antonym|word form|collocation|phrasal verb)\b/gi,
            /\b(reading comprehension|fill in the blank|choose the correct answer|true or false)\b/gi,
            /\b(present simple|past continuous|future perfect|gerund|infinitive|participle|modal verb)\b/gi,
            /\b(preposition|article|pronoun|conjunction|adverb|adjective)\b/gi,
            /\b(pronunciation|stress|phonetic|IPA)\b/gi,
            /\b(write a paragraph|write an essay|in about \d+ words)\b/gi
        ],
        economics: [
            /\b(kinh tế|kinh doanh|thị trường|cung|cầu|lạm phát|GDP|GNI|thu nhập|ngân sách|thuế|tài chính)\b/gi,
            /\b(pháp luật|luật|điều|khoản|hiến pháp|bộ luật|nghị định|thông tư|quyền|nghĩa vụ|công dân)\b/gi,
            /\b(hợp đồng|doanh nghiệp|công ty|sở hữu|tài sản|thừa kế|hôn nhân|lao động|vi phạm|trách nhiệm pháp lý)\b/gi,
            /\b(vi phạm hành chính|hình sự|dân sự|kỷ luật|tố tụng|toà án|viện kiểm sát|công an)\b/gi,
            /\b(cạnh tranh|độc quyền|đầu tư|tín dụng|ngân hàng|chứng khoán|bảo hiểm)\b/gi,
            /\b(quy luật kinh tế|thị trường tự do|kế hoạch|cân bằng|thặng dư|thiếu hụt|giá cả|hàng hoá)\b/gi,
            /\b(hiến pháp|pháp chế|nhà nước|chính phủ|quốc hội|hội đồng nhân dân|uỷ ban nhân dân)\b/gi
        ],
        code: [
            /\b(function|class|method|variable|loop|array|object)\b/gi,
            /\b(python|javascript|java|c\+\+|html|css|sql|c#|php|ruby|go|rust)\b/gi,
            /```|`[a-z]+`/g
        ]
    };

    const PROFILES = {
        grind: { label:'⚡ Grind', emoji:'⚡', desc:'Nhanh nhất', settings:{ speed:'very_fast', smartness:'balanced', responseLength:'short', waitBeforeSend:'off', autoType:'off', recheckMode:'off', failRetryMode:'aggressive', notation:'symbols', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'normal', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'off', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'off', readyAutoEnter:'short', questionTypeDetection:'off', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'light' } },
        stealth: { label:'🎭 Stealth', emoji:'🎭', desc:'Giả người — variation', settings:{ speed:'normal', smartness:'balanced', responseLength:'normal', waitBeforeSend:'random', autoType:'human', recheckMode:'light', failRetryMode:'normal', notation:'random', chemNotation:'random', physicsNotation:'random', forceVietnamese:'on', vietnameseStrictness:'normal', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'sometimes', mistakeRate:'rare', diacriticRate:'sometimes', confidenceEnabled:'off', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'off', readyAutoEnter:'normal', questionTypeDetection:'off', humanTouch:'on', fatigueCurve:'on', duplicateGuard:'on', autoDisableAfterFailures:'three', justOneMore:'normal', behavioralFingerprint:'on', responseTimeJitter:'medium' } },
        exam: { label:'🔬 Exam', emoji:'🔬', desc:'Recheck nghiêm', settings:{ speed:'slow', smartness:'smart', responseLength:'long', waitBeforeSend:'normal', autoType:'off', recheckMode:'strict', failRetryMode:'normal', notation:'symbols', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'on', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'on', responseTimeJitter:'light' } },
        afk: { label:'🌙 AFK', emoji:'🌙', desc:'Chạy nền', settings:{ speed:'very_slow', smartness:'balanced', responseLength:'normal', waitBeforeSend:'long', autoType:'off', recheckMode:'light', failRetryMode:'infinite', notation:'symbols', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'normal', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:6, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'long', questionTypeDetection:'off', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'long', behavioralFingerprint:'on', responseTimeJitter:'medium' } },
        ninja: { label:'🥷 Ninja', emoji:'🥷', desc:'Variation tối đa', settings:{ speed:'slow', smartness:'smart', responseLength:'normal', waitBeforeSend:'long', autoType:'human', recheckMode:'strict', failRetryMode:'normal', notation:'random', chemNotation:'random', physicsNotation:'random', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'off', cacheFuzzy:'off', slangRate:'sometimes', mistakeRate:'rare', diacriticRate:'sometimes', confidenceEnabled:'on', confidenceThreshold:8, confidenceAction:'pause', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'on', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'long', questionTypeDetection:'on', humanTouch:'on', fatigueCurve:'on', duplicateGuard:'on', autoDisableAfterFailures:'three', justOneMore:'long', behavioralFingerprint:'on', responseTimeJitter:'heavy' } },
        quickStealth: { label:'⚡🎭 Quick Variation', emoji:'⚡', desc:'Nhanh nhưng biến thiên', settings:{ speed:'fast', smartness:'balanced', responseLength:'short', waitBeforeSend:'short', autoType:'fast', recheckMode:'off', failRetryMode:'normal', notation:'symbols', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'normal', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'rare', mistakeRate:'off', diacriticRate:'rare', confidenceEnabled:'off', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'off', readyAutoEnter:'short', questionTypeDetection:'off', humanTouch:'on', fatigueCurve:'on', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'short', behavioralFingerprint:'on', responseTimeJitter:'heavy' } },
        human: { label:'🧑 Human', emoji:'🧑', desc:'Như học sinh thật — không vội', settings:{ speed:'slow', smartness:'smart', responseLength:'normal', waitBeforeSend:'random', autoType:'human', recheckMode:'light', failRetryMode:'normal', notation:'vietnamese', chemNotation:'vietnamese', physicsNotation:'vietnamese', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'often', mistakeRate:'sometimes', diacriticRate:'often', confidenceEnabled:'off', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'on', fatigueCurve:'on', duplicateGuard:'on', autoDisableAfterFailures:'three', justOneMore:'long', behavioralFingerprint:'on', responseTimeJitter:'heavy' } },
        nightOwl: { label:'🦉 Night Owl', emoji:'🦉', desc:'Chạy chậm ban đêm', settings:{ speed:'slow', smartness:'smart', responseLength:'long', waitBeforeSend:'long', autoType:'human', recheckMode:'strict', failRetryMode:'infinite', notation:'vietnamese', chemNotation:'vietnamese', physicsNotation:'vietnamese', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'rare', mistakeRate:'off', diacriticRate:'rare', confidenceEnabled:'on', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'on', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'long', questionTypeDetection:'on', humanTouch:'on', fatigueCurve:'on', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'long', behavioralFingerprint:'on', responseTimeJitter:'heavy' } },
        paranoid: { label:'🛡️ Paranoid', emoji:'🛡️', desc:'Mọi layer bảo vệ — chậm nhưng an toàn', settings:{ speed:'very_slow', smartness:'smart', responseLength:'normal', waitBeforeSend:'very_long', autoType:'human', recheckMode:'strict', failRetryMode:'aggressive', notation:'random', chemNotation:'random', physicsNotation:'random', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'off', cacheFuzzy:'off', slangRate:'rare', mistakeRate:'rare', diacriticRate:'rare', confidenceEnabled:'on', confidenceThreshold:9, confidenceAction:'pause', ensembleEnabled:'on', ensembleCount:'three', ensembleStrategy:'unanimous', ensembleMode:'multi', routerEnabled:'on', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'long', questionTypeDetection:'on', humanTouch:'on', fatigueCurve:'on', duplicateGuard:'on', autoDisableAfterFailures:'three', justOneMore:'long', behavioralFingerprint:'on', responseTimeJitter:'heavy' } },
        accuracy: { label:'🎯 Accuracy', emoji:'🎯', desc:'Ensemble đa model', settings:{ speed:'normal', smartness:'smart', responseLength:'normal', waitBeforeSend:'short', autoType:'off', recheckMode:'strict', failRetryMode:'aggressive', notation:'symbols', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:8, confidenceAction:'pause', ensembleEnabled:'on', ensembleCount:'three', ensembleStrategy:'unanimous', ensembleMode:'multi', routerEnabled:'on', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'three', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } },
        math: { label:'📐 Toán', emoji:'📐', desc:'Ký hiệu VN "mũ 2"', settings:{ speed:'normal', smartness:'smart', responseLength:'long', waitBeforeSend:'normal', autoType:'off', recheckMode:'light', failRetryMode:'normal', notation:'vietnamese', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } },
        chemistry: { label:'🧪 Hoá', emoji:'🧪', desc:'Ion "H cộng"', settings:{ speed:'normal', smartness:'smart', responseLength:'long', waitBeforeSend:'normal', autoType:'off', recheckMode:'light', failRetryMode:'normal', notation:'symbols', chemNotation:'vietnamese', physicsNotation:'symbols', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } },
        physics: { label:'⚛️ Lý', emoji:'⚛️', desc:'"omega mũ 2"', settings:{ speed:'normal', smartness:'smart', responseLength:'long', waitBeforeSend:'normal', autoType:'off', recheckMode:'light', failRetryMode:'normal', notation:'symbols', chemNotation:'symbols', physicsNotation:'vietnamese', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } },
        budget: { label:'💰 Budget', emoji:'💰', desc:'Rẻ + cache mạnh', settings:{ speed:'fast', smartness:'fast', responseLength:'short', waitBeforeSend:'off', autoType:'off', recheckMode:'off', failRetryMode:'normal', notation:'plaintext', chemNotation:'plaintext', physicsNotation:'plaintext', forceVietnamese:'on', vietnameseStrictness:'off', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'off', confidenceThreshold:6, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'off', readyAutoEnter:'short', questionTypeDetection:'off', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } },
        bilingual: { label:'🌐 Bilingual', emoji:'🌐', desc:'Cho phép tiếng Anh', settings:{ speed:'normal', smartness:'balanced', responseLength:'normal', waitBeforeSend:'off', autoType:'off', recheckMode:'light', failRetryMode:'normal', notation:'symbols', chemNotation:'symbols', physicsNotation:'symbols', forceVietnamese:'off', vietnameseStrictness:'off', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'off', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'off', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } },
        smartVN: { label:'🧠 Smart VN', emoji:'🧠', desc:'Chất lượng cao', settings:{ speed:'normal', smartness:'genius', responseLength:'long', waitBeforeSend:'normal', autoType:'off', recheckMode:'strict', failRetryMode:'normal', notation:'vietnamese', chemNotation:'vietnamese', physicsNotation:'vietnamese', forceVietnamese:'on', vietnameseStrictness:'strict', cacheEnabled:'on', cacheFuzzy:'on', slangRate:'off', mistakeRate:'off', diacriticRate:'off', confidenceEnabled:'on', confidenceThreshold:7, confidenceAction:'recheck', ensembleEnabled:'off', ensembleCount:'three', ensembleStrategy:'majority', ensembleMode:'single', routerEnabled:'on', imageSupport:'on', imageAutoRoute:'on', subjectDetection:'on', readyAutoEnter:'normal', questionTypeDetection:'on', humanTouch:'off', fatigueCurve:'off', duplicateGuard:'on', autoDisableAfterFailures:'off', justOneMore:'off', behavioralFingerprint:'off', responseTimeJitter:'off' } }
    };

    const QUESTION_TYPE_INSTRUCTIONS = {
        mcq:'Đây là câu hỏi TRẮC NGHIỆM. Chỉ trả lời bằng chữ cái đáp án đúng.',
        multipart:'Đây là câu hỏi NHIỀU PHẦN. Trả lời từng phần rõ ràng.',
        essay:'Đây là câu hỏi TỰ LUẬN.',
        calc:'Đây là bài TOÁN. Kiểm tra kỹ đơn vị.',
        fill:'Đây là bài ĐIỀN KHUYẾT.',
        unknown:''
    };
    const SLANG_PRESETS = { off:{label:'🚫 Không bao giờ',chance:0,level:'none',always:false,desc:'Luôn đầy đủ'}, rare:{label:'🍀 Hiếm khi',chance:0.15,level:'light',always:false,desc:'~15%'}, sometimes:{label:'🎲 Thỉnh thoảng',chance:0.35,level:'medium',always:false,desc:'~35%'}, often:{label:'🎯 Thường xuyên',chance:0.60,level:'heavy',always:false,desc:'~60%'}, always:{label:'💯 LUÔN LUÔN',chance:1.00,level:'heavy',always:true,desc:'100%'} };
    const SLANG_DICT_LIGHT = [['không','ko'],['được','đc'],['rồi','r'],['vậy','z'],['gì','j'],['với','vs']];
    const SLANG_DICT_MEDIUM = [...SLANG_DICT_LIGHT,['nhiều','nhìu'],['biết','bít'],['bạn','bn'],['mình','mk'],['làm','lm'],['luôn','lun'],['hiểu','hỉu'],['thế','th'],['này','nè'],['chị','c']];
    const SLANG_DICT_HEAVY = [...SLANG_DICT_MEDIUM,['bây giờ','bh'],['tại sao','tsao'],['thế nào','tno'],['bao nhiêu','bn'],['thôi','thoi'],['xong','xg'],['đúng','đg'],['nhé','nhe'],['vâng','vg'],['dạ','da'],['chào','chao'],['cảm ơn','camon']];
    const SLANG_DICTS = { none:[], light:SLANG_DICT_LIGHT, medium:SLANG_DICT_MEDIUM, heavy:SLANG_DICT_HEAVY };
    const MISTAKE_PRESETS = { off:{label:'🚫 Không bao giờ',chance:0,desc:'Luôn đúng'}, rare:{label:'🍀 Hiếm khi',chance:0.08,desc:'~8% sai'}, sometimes:{label:'🎲 Thỉnh thoảng',chance:0.20,desc:'~20% sai'}, often:{label:'🎯 Thường xuyên',chance:0.35,desc:'~35% sai'} };
    const DIACRITIC_PRESETS = { off:{label:'🚫 Không bao giờ',chance:0,desc:'Luôn đủ dấu',always:false}, rare:{label:'🍀 Hiếm khi',chance:0.10,desc:'~10% quên dấu',always:false}, sometimes:{label:'🎲 Thỉnh thoảng',chance:0.25,desc:'~25% quên dấu',always:false}, often:{label:'🎯 Thường xuyên',chance:0.40,desc:'~40% quên dấu',always:false}, always:{label:'💯 LUÔN LUÔN',chance:1.00,desc:'100% không dấu',always:true} };

    const NOTATION_SYMBOLS_INSTRUCTION = 'Dùng ký hiệu toán học Unicode: √, π, ², ³, ×, ÷, ≈, ≤, ≥, ≠, ∞, ±. KHÔNG dùng °.';
    const NOTATION_PLAINTEXT_INSTRUCTION = 'KHÔNG dùng Unicode. Viết: √→sqrt, π→pi, ²→^2, ×→x, ÷→/, ≈→~=, ≤→<=, ≥→>=, °→degree.';
    const NOTATION_VIETNAMESE_INSTRUCTION = 'KHÔNG dùng Unicode. √→"căn", π→"pi". Số mũ: ²→"mũ 2", ³→"mũ 3". +→"cộng", -→"trừ", ×→"nhân", ÷→"chia", =→"bằng", °→"độ".';
    const NOTATION_PRESETS = {
        symbols:{label:'🔣 Ký hiệu toán',desc:'Unicode',instruction:NOTATION_SYMBOLS_INSTRUCTION},
        plaintext:{label:'🔤 Chữ thường',desc:'Không đặc biệt',instruction:NOTATION_PLAINTEXT_INSTRUCTION},
        vietnamese:{label:'🇻🇳 Tiếng Việt',desc:'Viết như đọc',instruction:NOTATION_VIETNAMESE_INSTRUCTION},
        random:{label:'🎲 Ngẫu nhiên',desc:'Đổi mỗi lần',instruction:null}
    };
    const PHYSICS_SYMBOLS_INSTRUCTION = 'Dùng ký hiệu vật lý Unicode: ω, α, θ, Δ, μ, λ, ρ, φ, Ω. Chỉ số dưới: vₘₐₓ, vₘᵢₙ, x₀. Vector: F⃗, v⃗.';
    const PHYSICS_PLAINTEXT_INSTRUCTION = 'KHÔNG dùng Unicode. ω→omega, α→alpha, θ→theta, Δ→delta, μ→mu, λ→lambda, ρ→rho, φ→phi, Ω→Omega. Chỉ số: v_max, v_min, x_0.';
    const PHYSICS_VIETNAMESE_INSTRUCTION = 'Viết công thức vật lý bằng lời tiếng Việt. ω→"omega", λ→"lambda". Số mũ: ²→"mũ 2". ±→"cộng trừ". Nhân→"nhân". Chia→"chia". GIỮ đơn vị SI.';
    const PHYSICS_NOTATION_PRESETS = {
        symbols: { label:'⚛️ Ký hiệu vật lý', desc:'Unicode', instruction: PHYSICS_SYMBOLS_INSTRUCTION },
        plaintext: { label:'🔤 Chữ thường', desc:'ASCII', instruction: PHYSICS_PLAINTEXT_INSTRUCTION },
        vietnamese: { label:'🇻🇳 Tiếng Việt', desc:'Viết như đọc', instruction: PHYSICS_VIETNAMESE_INSTRUCTION },
        random: { label:'🎲 Ngẫu nhiên', desc:'Đổi mỗi lần', instruction: null }
    };
    const CHEM_SYMBOLS_INSTRUCTION = 'Dùng ký hiệu hoá học Unicode: H⁺, Cl⁻, NH₄⁺, CO₃²⁻, SO₄²⁻. Công thức: H₂O, CO₂, NH₃. ⇌ và →.';
    const CHEM_PLAINTEXT_INSTRUCTION = 'KHÔNG dùng Unicode. Ion: H⁺→H+, Cl⁻→Cl-, NH₄⁺→NH4+. Công thức: H₂O→H2O, CO₂→CO2.';
    const CHEM_VIETNAMESE_INSTRUCTION = 'Viết ký hiệu hoá học bằng lời tiếng Việt. H⁺→"H cộng", Cl⁻→"Cl trừ", Ba²⁺→"Ba2 cộng". Số trong công thức giữ nguyên: H₂O→H2O, CO₂→CO2.';
    const CHEM_NOTATION_PRESETS = {
        symbols: { label:'⚛️ Ký hiệu hoá học', desc:'Unicode', instruction: CHEM_SYMBOLS_INSTRUCTION },
        plaintext: { label:'🔤 Chữ thường', desc:'Không đặc biệt', instruction: CHEM_PLAINTEXT_INSTRUCTION },
        vietnamese: { label:'🇻🇳 Tiếng Việt', desc:'Viết như đọc', instruction: CHEM_VIETNAMESE_INSTRUCTION },
        random: { label:'🎲 Ngẫu nhiên', desc:'Đổi mỗi lần', instruction: null }
    };

    const SMART_PRESET_TEXT = 'You are an analytical thinking assistant. Whenever I give you an idea, you must analyze it using a **Tree Root Thinking Framework**.';
    const STUDENT_PRESET_TEXT = 'Bạn là học sinh giỏi đang trả lời câu hỏi trong lớp. Quy tắc:\n1. Đọc kỹ đề, xác định dạng bài.\n2. Trả lời ngắn gọn, đúng trọng tâm.\n3. Nếu đề yêu cầu định dạng "Trả lời: [đáp án]", trả lời đúng định dạng.\n4. Không markdown, không LaTeX. Dùng Unicode: √, π, ².\n5. Nếu có nhiều phần (a,b,c), trả lời gọn từng phần.';
    const PROMPT_PRESETS = {
        blank: { label:'Trống', desc:'Xóa hết prompt', emoji:'📄', text:'' },
        student: { label:'Học sinh giỏi', desc:'Ngắn gọn, đúng trọng tâm', emoji:'🎓', text:STUDENT_PRESET_TEXT },
        smart: { label:'Smart Preset', desc:'Tree Root Thinking', emoji:'🧠', text:SMART_PRESET_TEXT }
    };

    // ============================================================
    // SETTINGS LOAD/SAVE
    // ============================================================
    function uid() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'k_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    function loadSettings() {
        try {
            const raw = GM_getValue('auto_chat_settings', '');
            if (raw) {
                const parsed = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
                delete parsed.realisticIdlePauses;
                delete parsed.timeOfDayAwareness;
                delete parsed.customActiveHourStart;
                delete parsed.customActiveHourEnd;
                delete parsed.teacherTypingDetector;
                delete parsed.teacherTypingMaxWait;
                delete parsed.humanPresenceDetection;
                delete parsed.humanPresenceIdleMinutes;
                return ensureValidKeys(migrateOldKey(parsed));
            }
        } catch (e) {}
        return ensureValidKeys(migrateOldKey(Object.assign({}, DEFAULT_SETTINGS)));
    }
    function migrateOldKey(settings) {
        if (Array.isArray(settings.keys) && settings.keys.length > 0) return settings;
        const legacyKey = GM_getValue('groq_api_key', '');
        if (!legacyKey || !legacyKey.startsWith('gsk_')) return settings;
        const migrated = { id: 'k_legacy', provider: 'groq', model: 'openai/gpt-oss-20b', name: 'Groq (auto-migrated)', key: legacyKey, enabled: true };
        settings.keys = [migrated];
        settings.activeKeyId = migrated.id;
        return settings;
    }
    function ensureValidKeys(settings) {
        if (!Array.isArray(settings.keys)) { settings.keys = []; return settings; }
        let changed = false;
        for (const k of settings.keys) {
            if (!k.id) { k.id = uid(); changed = true; }
            if (k.enabled === undefined) { k.enabled = true; changed = true; }
            if (!k.model || !String(k.model).trim()) {
                const p = PROVIDERS[k.provider];
                k.model = (p?.models?.[0]?.id) || 'openai/gpt-oss-20b';
                changed = true;
                console.warn(`[Auto Chat] Key "${k.name || k.id}" thiếu model — auto-fill: ${k.model}`);
            }
        }
        if (changed) {
            try { GM_setValue('auto_chat_settings', JSON.stringify(settings)); } catch (e) {}
        }
        return settings;
    }
    function saveSettings(s) { GM_setValue('auto_chat_settings', JSON.stringify(s)); }

    let SETTINGS = loadSettings();
    let activeSettingsTab = 'quick';

    // ============================================================
    // SELF-HEALING SELECTORS
    // ============================================================
    const SELECTOR_CHAINS = {
        textarea: {
            label: 'Answer textarea',
            resolvers: [
                { type: 'css', value: 'textarea.w-md-editor-text-input' },
                { type: 'css', value: '.w-md-editor textarea' },
                { type: 'css', value: 'textarea[placeholder*="Enter" i]' },
                { type: 'css', value: 'textarea[placeholder*="gửi" i]' },
                { type: 'css', value: 'textarea[placeholder*="trả lời" i]' },
                { type: 'css', value: '.chat-footer textarea, [class*="footer"] textarea' },
                { type: 'css', value: '.chat-footer input[type="text"], .chat-footer input:not([type])' },
                { type: 'css', value: '.chat-footer [contenteditable="true"]' },
                { type: 'css', value: 'textarea[placeholder*="trả lời" i]' },
                { type: 'css', value: 'textarea[placeholder*="câu trả lời" i]' },
                { type: 'css', value: 'textarea[placeholder*="answer" i]' },
                { type: 'css', value: 'textarea[placeholder*="type" i]' },
                { type: 'css', value: 'textarea[class*="md-editor"]' },
                { type: 'css', value: '.w-md-editor textarea' },
                { type: 'css', value: 'textarea:not([readonly]):not([disabled])' },
                { type: 'css', value: '[contenteditable="true"]' },
                { type: 'css', value: 'input[placeholder*="gửi" i]' },
                { type: 'css', value: 'input[placeholder*="Enter" i]' },
                { type: 'fn', value: () => Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')).find(t => t.offsetParent !== null) || null }
            ]
        },
        submitBtn: {
            label: 'Submit button',
            resolvers: [
                { type: 'fn', value: () => {
                    const els = Array.from(document.querySelectorAll('.exercise-intent-radial__item, button, [role="button"], [aria-label], [title]'));
                    return els.find(el => {
                        const label = [el.innerText, el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid')].filter(Boolean).join(' ').trim();
                        return /nộp\s*(câu trả lời|bài)?|submit(\s*answer)?|send\s*answer|gửi\s*câu trả lời/i.test(label);
                    }) || null;
                } },
                { type: 'fn', value: () => Array.from(document.querySelectorAll('button, [role="button"]')).find(el => /^(Nộp câu trả lời|Nộp bài|Submit|Submit answer|Ready|Gửi|Send)$/i.test((el.innerText||'').trim())) || null },
                { type: 'fn', value: () => {
                    // Find circular send button or button containing SVG arrow near composer
                    const ta = resolveSelector('textarea');
                    return findComposerSendButton(ta);
                }},
                { type: 'fn', value: () => Array.from(document.querySelectorAll('button')).find(el => /nộp|submit|send|gửi/i.test(el.innerText||'')) || null }
            ]
        },
        messageStack: {
            label: 'Message stack',
            resolvers: [
                { type: 'fn', value: () => findEduNextMessages() },
                { type: 'cssAll', value: '.message-content, [class*="message-content"], [class*="messageContent"]' },
                { type: 'cssAll', value: '.assistant-message-stack, [class*="assistant-message"]' },
                { type: 'cssAll', value: '[class*="chat-message"], [class*="chat_message"], [class*="ChatMessage"]' },
                { type: 'cssAll', value: '.prose, [class*="markdown"]' }
            ]
        }
    };

    const selectorCache = {};
    const selectorStats = {};

    function runResolver(r, isMulti) {
        try {
            if (r.type === 'css') {
                const el = document.querySelector(r.value);
                return isMulti ? (el ? [el] : []) : el;
            }
            if (r.type === 'cssAll') return Array.from(document.querySelectorAll(r.value));
            if (r.type === 'fn') {
                const result = r.value();
                if (isMulti) return Array.isArray(result) ? result : (result ? [result] : []);
                return result;
            }
        } catch (e) { /* swallow */ }
        return isMulti ? [] : null;
    }

    function logSelectorEvent(level, message) {
        if (SETTINGS.selfHealingEnabled !== 'on') return;
        const cfgLevel = SETTINGS.selectorLogLevel || 'warn';
        const order = { off: 0, error: 1, warn: 2, info: 3 };
        if (order[level] > (order[cfgLevel] || 2)) return;
        if (level === 'error') logActivity('failed', `🎯 ${message}`);
        else if (level === 'warn') logActivity('warn', `🎯 ${message}`);
        else logActivity('info', `🎯 ${message}`);
        if ((level === 'warn' || level === 'error') && !buttonsHidden) {
            showToast(`🎯 ${message}`, level === 'error' ? 'error' : 'warn', 4000);
        }
    }

    function resolveSelector(key, opts = {}) {
        const chain = SELECTOR_CHAINS[key];
        if (!chain) return opts.multi ? [] : null;
        const isMulti = opts.multi === true;
        const healing = SETTINGS.selfHealingEnabled === 'on';

        if (healing) {
            const cached = selectorCache[key];
            if (cached) {
                const r = chain.resolvers[cached.resolverIdx];
                if (r) {
                    const result = runResolver(r, isMulti);
                    const hasValidText = !isMulti || (result && result.length > 0 && result.some(el => ((el && el.innerText) || '').trim().length > 5));
                    if (result && (!isMulti || (result.length > 0 && hasValidText))) {
                        if (!selectorStats[key]) selectorStats[key] = { primaryHits: 0, fallbackHits: 0, misses: 0, changes: [] };
                        if (cached.resolverIdx === 0) selectorStats[key].primaryHits++;
                        else selectorStats[key].fallbackHits++;
                        return result;
                    }
                    delete selectorCache[key];
                    logSelectorEvent('warn', `${chain.label}: cached resolver failed, re-probing`);
                }
            }
        }

        const limit = chain.resolvers.length;
        for (let i = 0; i < limit; i++) {
            const r = chain.resolvers[i];
            const result = runResolver(r, isMulti);
            const hasValidText = !isMulti || (result && result.length > 0 && result.some(el => ((el && el.innerText) || '').trim().length > 5));
            if (result && (!isMulti || (result.length > 0 && hasValidText))) {
                if (healing) {
                    if (!selectorStats[key]) selectorStats[key] = { primaryHits: 0, fallbackHits: 0, misses: 0, changes: [] };
                    selectorCache[key] = { resolverIdx: i, since: Date.now() };
                    if (i === 0) selectorStats[key].primaryHits++;
                    else {
                        selectorStats[key].fallbackHits++;
                        const lastChange = selectorStats[key].changes[selectorStats[key].changes.length - 1];
                        if (!lastChange || lastChange.idx !== i) {
                            selectorStats[key].changes.push({ idx: i, at: Date.now() });
                            logSelectorEvent('warn', `${chain.label}: switched to fallback #${i + 1}`);
                        }
                    }
                }
                return result;
            }
        }

        if (healing) {
            if (!selectorStats[key]) selectorStats[key] = { primaryHits: 0, fallbackHits: 0, misses: 0, changes: [] };
            selectorStats[key].misses++;
            logSelectorEvent('error', `${chain.label}: ALL resolvers failed`);
        }
        return isMulti ? [] : null;
    }

    function getSelectorReport() {
        return Object.entries(SELECTOR_CHAINS).map(([key, chain]) => {
            const stats = selectorStats[key] || { primaryHits: 0, fallbackHits: 0, misses: 0, changes: [] };
            const cached = selectorCache[key];
            return { key, label: chain.label, stats, active: cached ? cached.resolverIdx : null, totalResolvers: chain.resolvers.length };
        });
    }

    function resetSelectorCache() {
        Object.keys(selectorCache).forEach(k => delete selectorCache[k]);
        Object.keys(selectorStats).forEach(k => delete selectorStats[k]);
        logSelectorEvent('info', 'Selector cache reset');
    }

    let domHealthIntervalId = null;
    function startDomHealthMonitor() {
        if (domHealthIntervalId) { clearInterval(domHealthIntervalId); domHealthIntervalId = null; }
        if (!isRunning) return;
        if (SETTINGS.domHealthEnabled !== 'on') return;
        setTimeout(() => { if (isRunning) tickHealthMonitor(); }, 300);
        const ms = (parseInt(SETTINGS.domHealthInterval, 10) || 30) * 1000;
        domHealthIntervalId = setInterval(() => { if (isRunning) tickHealthMonitor(); }, ms);
    }
    function stopDomHealthMonitor() {
        if (domHealthIntervalId) { clearInterval(domHealthIntervalId); domHealthIntervalId = null; }
    }
    function tickHealthMonitor() {
        const report = getSelectorReport();
        const issues = report.filter(r => r.active === null);
        if (issues.length > 0) {
            logSelectorEvent('error', `Health: ${issues.length} selector(s) failing — ${issues.map(i => i.label).join(', ')}`);
        } else if (SETTINGS.selectorLogLevel === 'info') {
            logSelectorEvent('info', `Health OK (${report.length} selectors resolved)`);
        }
    }

    // ============================================================
    // HEALTH CHECK
    // ============================================================
    let lastHealthReport = null;

    function runHealthCheck() {
        const checks = [];

        const urlOk = /fsc-edunext\.fpt\.edu\.vn|\.fpt\.edu\.vn/.test(location.hostname);
        checks.push({ id: 'url', name: 'URL khớp domain FPT', ok: urlOk, detail: location.hostname, critical: true, hint: 'Trang hiện tại không phải Edunext FPT.' });

        const ta = resolveSelector('textarea');
        const taIdx = selectorCache.textarea?.resolverIdx;
        const taDetail = ta ? (taIdx === 0 || taIdx === undefined ? 'Resolver #1 (primary)' : `Resolver #${taIdx + 1} (fallback)`) : 'Không tìm thấy';
        checks.push({ id: 'textarea', name: 'Ô nhập câu trả lời', ok: !!ta, detail: taDetail, critical: true, hint: 'Edunext có thể đã đổi cấu trúc editor.' });

        const btn = resolveSelector('submitBtn');
        const btnIdx = selectorCache.submitBtn?.resolverIdx;
        const btnDetail = btn ? (btnIdx === 0 || btnIdx === undefined ? 'Nút đã nhận diện' : `Nút dự phòng #${btnIdx + 1}`) : (ta ? 'Không thấy nút; dùng Enter dự phòng' : 'Không tìm thấy nút hoặc ô nhập');
        checks.push({ id: 'submit', name: 'Gửi câu trả lời', ok: !!btn || !!ta, detail: btnDetail, critical: true, hint: 'Nếu Enter không gửi được, EduNext có thể đã đổi nút submit.' });

        const msgs = resolveSelector('messageStack', { multi: true });
        const msgsIdx = selectorCache.messageStack?.resolverIdx;
        const msgsDetail = msgs.length > 0 ? `${msgs.length} tin nhắn · ${msgsIdx === 0 || msgsIdx === undefined ? 'primary' : 'fallback #' + (msgsIdx + 1)}` : 'Không có tin nhắn nào';
        checks.push({ id: 'messages', name: 'Khung tin nhắn AI', ok: msgs.length > 0, detail: msgsDetail, critical: false, hint: 'Cần ít nhất 1 tin nhắn AI.' });

        const editor = document.querySelector('.w-md-editor, [class*="md-editor"]');
        checks.push({ id: 'editor', name: 'Trình soạn thảo (MD Editor)', ok: !!editor, detail: editor ? 'Có' : 'Không thấy', critical: false, hint: 'Editor component không tải.' });

        const hasAssistant = document.querySelector('[class*="assistant"], [class*="message"]');
        checks.push({ id: 'chatctx', name: 'Khung chat bài học', ok: !!hasAssistant, detail: hasAssistant ? 'Có' : 'Không thấy', critical: false, hint: 'Có thể chưa vào bài học.' });

        const hasRadix = document.querySelector('[data-radix-popper-content-wrapper], [data-state], .radix-themes, [data-radix-collection-item]');
        checks.push({ id: 'radix', name: 'UI framework (Radix)', ok: !!hasRadix, detail: hasRadix ? 'Có' : 'Không thấy', critical: false, hint: 'Edunext có thể đã đổi framework UI.' });

        const hasExerciseUI = document.querySelector('.exercise-intent-radial__item, [class*="exercise"], [class*="radial"]');
        checks.push({ id: 'exercise', name: 'UI bài tập', ok: !!hasExerciseUI, detail: hasExerciseUI ? 'Có' : 'Không thấy', critical: false, hint: 'Có thể chưa vào bài tập.' });

        const selReport = getSelectorReport();
        const fallbacksInUse = selReport.filter(r => r.active !== null && r.active > 0).length;
        checks.push({ id: 'fallbacks', name: 'Resolver fallback đang dùng', ok: fallbacksInUse === 0, detail: fallbacksInUse === 0 ? 'Không có (tốt)' : `${fallbacksInUse} selector đang dùng fallback`, critical: false, hint: 'Primary không còn khớp.' });

        const critOk = checks.filter(c => c.critical).every(c => c.ok);
        const okCount = checks.filter(c => c.ok).length;
        const score = Math.round((okCount / checks.length) * 100);

        const report = {
            timestamp: Date.now(),
            checks, critOk, okCount, total: checks.length, score,
            running: isRunning, version: CURRENT_VERSION, url: location.href
        };
        lastHealthReport = report;
        return report;
    }

    function scoreColor(score) {
        if (score >= 90) return '#059669';
        if (score >= 70) return '#f59e0b';
        if (score >= 40) return '#d97706';
        return '#dc2626';
    }
    function scoreLabel(score) {
        if (score >= 90) return 'Rất tốt — mọi thứ khớp với script';
        if (score >= 70) return 'Khá ổn — có vài thứ cần chú ý';
        if (score >= 40) return 'Có vấn đề — Edunext có thể đã thay đổi';
        return 'Nghiêm trọng — script có thể không chạy được';
    }

    // ============================================================
    // VARIATION ENGINE
    // ============================================================
    let sessionFingerprint = null;
    function getSessionFingerprint() {
        if (sessionFingerprint) return sessionFingerprint;
        const seed = Math.random();
        sessionFingerprint = {
            seed,
            typingMultiplier: 0.70 + seed * 0.60,
            pauseMultiplier:  0.60 + (1 - seed) * 0.80,
            jitterBias:       (seed * 2 - 1) * 0.25
        };
        return sessionFingerprint;
    }
    function applyFingerprint(baseMs, kind = 'typing') {
        if (SETTINGS.behavioralFingerprint !== 'on') return baseMs;
        const fp = getSessionFingerprint();
        const mult = kind === 'pause' ? fp.pauseMultiplier : fp.typingMultiplier;
        return Math.max(5, Math.round(baseMs * mult));
    }

    function applyResponseJitter(baseMs) {
        const mode = SETTINGS.responseTimeJitter || 'off';
        if (mode === 'off') return baseMs;
        const preset = RESPONSE_JITTER_PRESETS[mode] || RESPONSE_JITTER_PRESETS.off;
        const variance = baseMs * preset.factor;
        const jittered = baseMs + (Math.random() * 2 - 1) * variance;
        return Math.max(preset.minMs || 0, Math.round(jittered));
    }

    // ============================================================
    // SETTINGS GETTERS
    // ============================================================
    const getSpeed = () => SPEED_PRESETS[SETTINGS.speed] || SPEED_PRESETS.normal;
    const getSmartness = () => SMARTNESS_PRESETS[SETTINGS.smartness] || SMARTNESS_PRESETS.balanced;
    const getResponseLength = () => RESPONSE_LENGTH_PRESETS[SETTINGS.responseLength] || RESPONSE_LENGTH_PRESETS.normal;
    const getWaitBeforeSend = () => WAIT_BEFORE_SEND_PRESETS[SETTINGS.waitBeforeSend] || WAIT_BEFORE_SEND_PRESETS.off;
    const getAutoType = () => AUTO_TYPE_PRESETS[SETTINGS.autoType] || AUTO_TYPE_PRESETS.off;
    const getReadyAutoEnter = () => READY_AUTO_ENTER_PRESETS[SETTINGS.readyAutoEnter] || READY_AUTO_ENTER_PRESETS.normal;
    const getRecheck = () => RECHECK_PRESETS[SETTINGS.recheckMode] || RECHECK_PRESETS.off;
    const getFailRetry = () => FAIL_RETRY_PRESETS[SETTINGS.failRetryMode] || FAIL_RETRY_PRESETS.normal;
    const isFilterIdsOn = () => SETTINGS.filterIds !== 'off';
    const isStripPrefixOn = () => SETTINGS.stripReplyPrefix !== 'off';
    const isForceVietnameseOn = () => SETTINGS.forceVietnamese !== 'off';
    const getVietnameseStrictness = () => SETTINGS.vietnameseStrictness || 'normal';
    const getSlang = () => SLANG_PRESETS[SETTINGS.slangRate] || SLANG_PRESETS.off;
    const getMistake = () => MISTAKE_PRESETS[SETTINGS.mistakeRate] || MISTAKE_PRESETS.off;
    const getDiacritic = () => DIACRITIC_PRESETS[SETTINGS.diacriticRate] || DIACRITIC_PRESETS.off;
    const getNotation = () => NOTATION_PRESETS[SETTINGS.notation] || NOTATION_PRESETS.symbols;
    const getChemNotation = () => CHEM_NOTATION_PRESETS[SETTINGS.chemNotation] || CHEM_NOTATION_PRESETS.symbols;
    const getPhysicsNotation = () => PHYSICS_NOTATION_PRESETS[SETTINGS.physicsNotation] || PHYSICS_NOTATION_PRESETS.symbols;
    const getCustomPrompt = () => (SETTINGS.customPrompt || '').trim();
    const getAutoDisable = () => AUTO_DISABLE_PRESETS[SETTINGS.autoDisableAfterFailures] || AUTO_DISABLE_PRESETS.off;
    const getJustOneMore = () => JUST_ONE_MORE_PRESETS[SETTINGS.justOneMore] || JUST_ONE_MORE_PRESETS.off;
    const isQuestionTypeOn = () => SETTINGS.questionTypeDetection === 'on';
    const isHumanTouchOn = () => SETTINGS.humanTouch === 'on';
    const isFatigueOn = () => SETTINGS.fatigueCurve === 'on';
    const isDuplicateGuardOn = () => SETTINGS.duplicateGuard !== 'off';
    const isToastsOn = () => SETTINGS.toasts !== 'off';
    const getFailureNotif = () => SETTINGS.failureNotification || 'toast';
    const isFailureNotifOn = () => getFailureNotif() !== 'off';
    const isConfidenceOn = () => SETTINGS.confidenceEnabled === 'on';
    const getConfidenceThreshold = () => parseInt(SETTINGS.confidenceThreshold, 10) || 7;
    const isEnsembleOn = () => SETTINGS.ensembleEnabled === 'on';
    const isMultiModelOn = () => SETTINGS.ensembleMode === 'multi';
    const isRouterOn = () => SETTINGS.routerEnabled === 'on';
    const isImageSupportOn = () => SETTINGS.imageSupport !== 'off';
    const isImageAutoRouteOn = () => SETTINGS.imageAutoRoute !== 'off';
    const isSubjectDetectionOn = () => SETTINGS.subjectDetection === 'on';
    const isFreeModelsAutoRefreshOn = () => SETTINGS.freeModelsAutoRefresh !== 'off';

    function getActiveKey() {
        const keys = SETTINGS.keys || [];
        const active = keys.find(k => k.id === SETTINGS.activeKeyId && k.enabled !== false);
        if (active && active.model && String(active.model).trim()) return active;
        return keys.find(k => k.enabled !== false && k.model && String(k.model).trim()) || null;
    }
    function getModel() { const k = getActiveKey(); return k?.model || '(no model)'; }
    function getActiveProvider() { const k = getActiveKey(); return k ? PROVIDERS[k.provider] : null; }
    function computeMaxTokens() { return Math.max(256, Math.min(8192, Math.round(getSmartness().max_tokens * getResponseLength().maxTokensMultiplier))); }
    function getFatigueMultiplier() { if (!isFatigueOn()) return 1; return 1 + Math.min(0.5, questionCount * 0.02); }
    function computeWaitBeforeSendMs() {
        const p = getWaitBeforeSend();
        if (p.max === 0) return 0;
        let base = p.min + Math.random() * (p.max - p.min);
        base *= getFatigueMultiplier();
        base = applyFingerprint(base, 'pause');
        base = applyResponseJitter(base);
        return Math.round(base);
    }
    function resolveNotationInstruction() { if (SETTINGS.notation === 'random') { const k = ['symbols','plaintext','vietnamese']; return NOTATION_PRESETS[k[Math.floor(Math.random()*3)]].instruction; } return getNotation().instruction; }
    function resolveChemNotationInstruction() { if (SETTINGS.chemNotation === 'random') { const k = ['symbols','plaintext','vietnamese']; return CHEM_NOTATION_PRESETS[k[Math.floor(Math.random()*3)]].instruction; } return getChemNotation().instruction; }
    function resolvePhysicsNotationInstruction() { if (SETTINGS.physicsNotation === 'random') { const k = ['symbols','plaintext','vietnamese']; return PHYSICS_NOTATION_PRESETS[k[Math.floor(Math.random()*3)]].instruction; } return getPhysicsNotation().instruction; }

    function detectQuestionType(text) {
        if (!text) return 'unknown';
        const t = text.substring(0, 2000);
        const mcqMatches = t.match(/\b[A-D][\.\)]\s+\S/g);
        if (mcqMatches && mcqMatches.length >= 3) return 'mcq';
        if (/\([a-c]\)/i.test(t)) return 'multipart';
        if (/trình\s*bày|giải\s*thích|chứng\s*minh|explain|describe|discuss|write a paragraph|write an essay|in your opinion/i.test(t)) return 'essay';
        if (/tính|tìm|giải\s*phương\s*trình|calculate|compute|solve the equation/i.test(t)) return 'calc';
        if (/điền|___|\.\.\.|fill in the blank|complete the sentence/i.test(t)) return 'fill';
        return 'unknown';
    }

    // ============================================================
    // TOASTS / NOTIF / LOG
    // ============================================================
    function escapeHtml(s) { if (s === null || s === undefined) return ''; return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

    function showToast(message, type = 'info', duration = 4000, force = false) {
        if (buttonsHidden) return;
        if (!force && !isToastsOn()) return;
        let container = document.getElementById('ac-toast-container');
        if (!container) { container = document.createElement('div'); container.id = 'ac-toast-container'; container.className = 'ac-toast-container'; document.body.appendChild(container); }
        const toast = document.createElement('div');
        toast.className = `ac-toast ac-toast-${type}`;
        const icon = type === 'success' ? '✅' : type === 'warn' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
        toast.innerHTML = `<span style="flex-shrink:0;">${icon}</span><span style="white-space:pre-line;">${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('ac-toast-out'); setTimeout(() => toast.remove(), 250); }, duration);
    }

    async function requestNotificationPermission() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        try { return (await Notification.requestPermission()) === 'granted'; } catch (e) { return false; }
    }

    function showFailureNotification(reason, detail = '') {
        if (!isFailureNotifOn()) return;
        if (buttonsHidden) return;
        aiFailureCount++;
        const mode = getFailureNotif();
        const suffix = aiFailureCount > 1 ? ` (lần ${aiFailureCount})` : '';
        if (mode === 'toast' || mode === 'both') showToast(detail ? `⚠️ <b>${reason}</b>${suffix}\n${detail}` : `⚠️ <b>${reason}</b>${suffix}`, 'error', 8000, true);
        if (mode === 'desktop' || mode === 'both') {
            if ('Notification' in window && Notification.permission === 'granted') {
                try { const n = new Notification('⚠️ Auto Chat gặp lỗi', { body: reason + (detail ? '\n' + detail : '') + suffix, tag: 'ac-failure' }); setTimeout(() => n.close(), 10000); } catch (e) {}
            }
        }
        logActivity('failed', `${reason}${suffix}${detail ? ' — ' + detail : ''}`);
    }

    // ============================================================
    // LIVE ACTIVITY PANEL
    // ============================================================
    const activityLog = [];
    const ACTIVITY_MAX = 80;
    let activityPanelOpen = false;

    function logActivity(type, message, opts = {}) {
        const iconMap = { question:'❓', thinking:'🧠', answer:'📝', submit:'📤', wait:'⏳', done:'✅', failed:'❌', cached:'⚡', retry:'🔄', info:'ℹ️', ensemble:'🗳️', image:'🖼️', router:'🎯', warn:'⚠️', free:'🆓' };
        const colorMap = { question:'#6366f1', thinking:'#8b5cf6', answer:'#0ea5e9', submit:'#0891b2', wait:'#f59e0b', done:'#059669', failed:'#dc2626', cached:'#f59e0b', retry:'#d97706', info:'#64748b', ensemble:'#8b5cf6', image:'#c026d3', router:'#10b981', warn:'#f97316', free:'#10b981' };
        activityLog.push({
            time: Date.now(), type,
            message: String(message || '').substring(0, 300),
            icon: opts.icon || iconMap[type] || '•',
            color: opts.color || colorMap[type] || '#64748b',
            detail: opts.detail || null
        });
        while (activityLog.length > ACTIVITY_MAX) activityLog.shift();
        renderActivityPanel();
    }
    function clearActivityLog() { activityLog.length = 0; renderActivityPanel(); }
    function formatActivityTime(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; }

    function renderActivityPanel() {
        const panel = document.getElementById('ac-activity-panel');
        if (!panel) return;
        const feed = panel.querySelector('#ac-activity-feed');
        const countEl = panel.querySelector('#ac-act-count');
        if (countEl) countEl.textContent = String(activityLog.length);
        if (!feed) return;
        if (activityLog.length === 0) {
            feed.innerHTML = `<div style="padding:30px 16px;text-align:center;color:#94a3b8;font-size:12px;"><div style="font-size:28px;margin-bottom:8px;">📺</div><div>Chưa có hoạt động nào</div></div>`;
            return;
        }
        feed.innerHTML = activityLog.slice().reverse().map((e, idx) => `<div class="ac-act-entry" data-activity-idx="${activityLog.length - 1 - idx}" style="border-left-color:${e.color};"><div class="ac-act-head"><span class="ac-act-icon">${e.icon}</span><span class="ac-act-time">${formatActivityTime(e.time)}</span><span class="ac-act-type" style="color:${e.color};">${e.type}</span></div><div class="ac-act-msg">${escapeHtml(e.message)}</div></div>`).join('');
        feed.scrollTop = 0;
    }
    function toggleActivityPanel(force) {
        const panel = document.getElementById('ac-activity-panel');
        if (!panel) return;
        activityPanelOpen = (typeof force === 'boolean') ? force : !activityPanelOpen;
        panel.classList.toggle('ac-activity-hidden', !activityPanelOpen);
        if (activityPanelOpen) renderActivityPanel();
    }
    function showActivityDetail(idx) {
        const entry = activityLog[idx];
        if (!entry) return;
        document.getElementById('ac-activity-detail')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-activity-detail';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '560px';
        box.innerHTML = `<div class="ac-dialog-header"><div><h3 class="ac-dialog-title">${entry.icon} Chi tiết</h3><p class="ac-dialog-subtitle">${new Date(entry.time).toLocaleString('vi-VN')}</p></div><button class="ac-dialog-close" id="act-det-close">×</button></div><div class="ac-dialog-body"><div class="ac-section"><h4 class="ac-section-title">Loại: ${entry.type}</h4><div class="ac-pg-panel" style="max-height:none;background:#fff;">${escapeHtml(entry.message)}</div></div>${entry.detail ? `<div class="ac-section"><h4 class="ac-section-title">Chi tiết</h4><div class="ac-pg-panel" style="max-height:400px;">${escapeHtml(entry.detail)}</div></div>` : ''}</div><div class="ac-dialog-footer"><button class="ac-btn ac-btn-secondary" id="act-det-copy">📄 Copy</button><button class="ac-btn ac-btn-primary" id="act-det-close-2">Đóng</button></div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        document.getElementById('act-det-close').onclick = close;
        document.getElementById('act-det-close-2').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.getElementById('act-det-copy').onclick = async () => {
            const txt = `[${formatActivityTime(entry.time)}] ${entry.icon} ${entry.type}: ${entry.message}${entry.detail ? '\n\n' + entry.detail : ''}`;
            try { await navigator.clipboard.writeText(txt); showToast('Đã copy', 'success', 1500); } catch (e) {}
        };
    }

    // ============================================================
    // IMAGE SCAN
    // ============================================================
    function extractImageBase64(el) {
        try {
            if (el.tagName === 'IMG') {
                const src = el.src || '';
                if (src.startsWith('data:')) return src;
                const canvas = document.createElement('canvas');
                let w = el.naturalWidth || el.width || 512;
                let h = el.naturalHeight || el.height || 512;
                const maxDim = 2048;
                if (w > maxDim || h > maxDim) { const r = Math.min(maxDim/w, maxDim/h); w = Math.round(w*r); h = Math.round(h*r); }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(el, 0, 0, w, h);
                return canvas.toDataURL('image/jpeg', 0.82);
            }
            if (el.tagName === 'CANVAS') return el.toDataURL('image/jpeg', 0.75);
        } catch (e) { return null; }
        return null;
    }
    function imageBytesToDataUrl(bytes, mime) {
        if (!(bytes instanceof ArrayBuffer) || !bytes.byteLength || bytes.byteLength > 12 * 1024 * 1024) return null;
        const view = new Uint8Array(bytes);
        let binary = '';
        for (let offset = 0; offset < view.length; offset += 0x8000) binary += String.fromCharCode(...view.subarray(offset, Math.min(offset + 0x8000, view.length)));
        return `data:${mime || 'image/jpeg'};base64,${btoa(binary)}`;
    }
    function fetchCapturedImage(url) {
        if (!url || url.startsWith('data:image/')) return Promise.resolve(url || null);
        if (capturedImageData.has(url)) return capturedImageData.get(url);
        const promise = new Promise(resolve => {
            const asDataUrl = blob => {
                if (!blob || blob.size > 12 * 1024 * 1024 || !/^image\//i.test(blob.type || '')) { resolve(null); return; }
                const reader = new FileReader();
                reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            };
            if (url.startsWith('blob:') || url.startsWith(location.origin + '/')) {
                fetch(url, { credentials: 'include' }).then(r => r.ok ? r.blob() : null).then(asDataUrl).catch(() => resolve(null));
                return;
            }
            try {
                GM_xmlhttpRequest({
                    method: 'GET', url, responseType: 'arraybuffer', timeout: 15000,
                    onload: r => {
                        const mime = (r.responseHeaders || '').match(/content-type:\s*([^;\r\n]+)/i)?.[1]?.trim() || 'image/jpeg';
                        resolve(imageBytesToDataUrl(r.response, mime));
                    },
                    onerror: () => resolve(null), ontimeout: () => resolve(null)
                });
            } catch (_) { resolve(null); }
        });
        capturedImageData.set(url, promise);
        return promise;
    }
    async function scanImagesFromText(text) {
        const containers = resolveSelector('messageStack', { multi: true }) || [];
        // Start with a screenshot explicitly selected by the user. Unlike the
        // page's cross-origin canvas, a FileReader data URL is readable by the API.
        const results = pendingManualVisionImages.slice(0, 2);
        if (results.length) return results;
        const last = containers.length ? containers[containers.length - 1] : null;
        const imgs = Array.from(last ? last.querySelectorAll('img, canvas') : []);
        for (const canvas of document.querySelectorAll('canvas')) if ((canvas.width || 0) >= 240 && (canvas.height || 0) >= 80 && !imgs.includes(canvas)) imgs.push(canvas);
        let tainted = 0;
        for (const el of imgs) {
            const w = el.naturalWidth || el.width || 0;
            const h = el.naturalHeight || el.height || 0;
            if (w < 60 && h < 60) continue;
            let b64 = extractImageBase64(el);
            if (!b64 && el.tagName === 'IMG') b64 = await fetchCapturedImage(el.currentSrc || el.src);
            if (!b64 && el.tagName === 'CANVAS') {
                tainted++;
                const urls = capturedCanvasSources.get(el) || [];
                for (const url of urls.slice().reverse()) { b64 = await fetchCapturedImage(url); if (b64) break; }
            }
            if (b64 && !results.includes(b64)) results.push(b64);
            if (results.length >= 3) break;
        }
        if (tainted && !results.length && Date.now() - lastTaintedCanvasNotice > 60_000) {
            lastTaintedCanvasNotice = Date.now();
            logActivity('warn', `Không đọc được ${tainted} canvas của trang (SecurityError/CORS). Dùng nút 📷 Ảnh để chọn ảnh chụp câu hỏi gửi cho model vision.`);
        }
        return results;
    }

    function chooseVisionScreenshot() {
        let input = document.getElementById('ac-vision-image-input');
        if (!input) {
            input = document.createElement('input');
            input.id = 'ac-vision-image-input';
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.addEventListener('change', () => {
                const file = input.files && input.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    showToast('⚠️ Hãy chọn tệp ảnh', 'warn', 3000);
                    input.value = '';
                    return;
                }
                if (file.size > 12 * 1024 * 1024) {
                    showToast('⚠️ Ảnh quá lớn (tối đa 12 MB)', 'warn', 3500);
                    input.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
                        showToast('❌ Không đọc được tệp ảnh', 'error', 3500);
                        return;
                    }
                    pendingManualVisionImages = [reader.result];
                    logActivity('image', `Đã đính kèm ảnh chụp: ${file.name} — sẽ gửi cùng câu hỏi tiếp theo`);
                    showToast(`🖼️ Đã chọn ảnh: ${file.name}`, 'success', 3500);
                };
                reader.onerror = () => showToast('❌ Trình duyệt không đọc được tệp ảnh', 'error', 3500);
                reader.readAsDataURL(file);
            });
            document.body.appendChild(input);
        }
        input.value = '';
        input.click();
    }
    async function getPersistentVisionVideo() {
        const hasLiveTrack = visionScreenStream && visionScreenStream.getVideoTracks().some(track => track.readyState === 'live');
        if (hasLiveTrack && visionScreenVideo && visionScreenVideo.videoWidth) return visionScreenVideo;
        if (visionScreenInitPromise) return visionScreenInitPromise;
        const capture = navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;
        if (!capture) throw new Error('Screen Capture API không khả dụng trong trình duyệt này');
        visionScreenInitPromise = (async () => {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 1, displaySurface: 'browser' },
                audio: false,
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                monitorTypeSurfaces: 'exclude',
                surfaceSwitching: 'exclude'
            });
            const selectedTrack = stream.getVideoTracks()[0];
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;
            visionScreenStream = stream;
            visionScreenVideo = video;
            const track = stream.getVideoTracks()[0];
            if (track) track.addEventListener('ended', () => {
                if (visionScreenStream === stream) {
                    visionScreenStream = null;
                    visionScreenVideo = null;
                    logActivity('warn', 'Chia sẻ màn hình đã dừng; cần bấm ⚡ Làm bài để cấp quyền lại');
                }
            }, { once: true });
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Hết thời gian chờ khung hình')), 8000);
                const ready = async () => {
                    try { await video.play(); clearTimeout(timer); resolve(); }
                    catch (err) { clearTimeout(timer); reject(err); }
                };
                if (video.readyState >= 2 && video.videoWidth) ready();
                else video.onloadedmetadata = ready;
                video.onerror = () => { clearTimeout(timer); reject(new Error('Không đọc được khung hình màn hình')); };
            });
            if (!video.videoWidth || !video.videoHeight) throw new Error('Nguồn chia sẻ không có hình ảnh');
            logActivity('info', 'Đã cấp quyền chia sẻ một lần; sẽ dùng lại luồng này cho các câu hỏi mới');
            return video;
        })();
        try { return await visionScreenInitPromise; }
        catch (err) {
            if (visionScreenStream) visionScreenStream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
            visionScreenStream = null; visionScreenVideo = null;
            throw err;
        } finally { visionScreenInitPromise = null; }
    }
    function stopPersistentVisionShare() {
        const stream = visionScreenStream;
        const video = visionScreenVideo;
        visionScreenStream = null;
        visionScreenVideo = null;
        if (stream) stream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} });
        if (video) { try { video.pause(); video.srcObject = null; } catch (_) {} }
        pendingManualVisionImages = [];
        pendingAutoVisionHash = '';
        pendingScreenVisionQuestion = false;
        pendingScreenVisionQuestionText = '';
    }
    async function capturePersistentVisionFrame() {
        const video = await getPersistentVisionVideo();
        if (!video.videoWidth || !video.videoHeight) throw new Error('Nguồn chia sẻ không có hình ảnh');
        await new Promise(resolve => {
            if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(() => resolve());
            else setTimeout(resolve, 250);
        });
        const maxDim = 2048;
        const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Không tạo được vùng ảnh chụp');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Send one focused frame. When the shared source is the whole desktop
        // and DevTools is docked on the right, crop to the browser viewport so
        // the model does not pay to analyze a second, mostly duplicate image.
        let image = canvas.toDataURL('image/jpeg', 0.78);
        const screenWidth = window.screen?.width || 0;
        const viewportRatio = screenWidth > 0 ? window.innerWidth / screenWidth : 1;
        if (video.videoWidth >= 1500 && viewportRatio > 0.45 && viewportRatio < 0.82) {
            const cropRatio = Math.max(0.55, Math.min(0.90, viewportRatio + 0.12));
            const cropWidth = Math.max(1, Math.round(canvas.width * cropRatio));
            const crop = document.createElement('canvas');
            crop.width = cropWidth;
            crop.height = canvas.height;
            const cropCtx = crop.getContext('2d', { alpha: false });
            if (cropCtx) {
                cropCtx.drawImage(canvas, 0, 0, cropWidth, canvas.height, 0, 0, cropWidth, canvas.height);
                image = crop.toDataURL('image/jpeg', 0.82);
            }
        }
        if (!image || image.length < 500) throw new Error('Ảnh chụp rỗng');
        return { image, images: [image], width: canvas.width, height: canvas.height };
    }    async function captureScreenForVision() {
        pendingScreenVisionQuestion = false;
        pendingManualVisionImages = [];
        pendingAutoVisionHash = '';
        pendingScreenVisionQuestionText = getLatestAIMessage() || '';
        try {
            // The first click opens the browser's required screen picker. Keep this
            // stream alive and reuse it; new questions can be captured automatically.
            const shot = await capturePersistentVisionFrame();
            pendingManualVisionImages = shot.images || [shot.image];
            pendingScreenVisionQuestion = true;
            logActivity('image', `Đã chụp ${shot.width}×${shot.height}; giữ chia sẻ để tự chụp câu hỏi tiếp theo`);
            showToast('📸 Đã chụp; giữ quyền chia sẻ để xử lý câu hỏi tiếp theo tự động', 'success', 3500);
            if (!isRunning) toggleAutoChat();
            else { lastProcessedHash = ''; setTimeout(() => runAutoChat(), 250); }
        } catch (e) {
            const message = e && e.name === 'NotAllowedError' ? 'Bạn đã hủy hoặc từ chối chia sẻ màn hình' : (e.message || 'Không chụp được màn hình');
            logActivity('warn', message);
            showToast(`⚠️ ${message}`, 'warn', 4000);
        }
    }
    function providerSupportsVision(keyEntry) {
        if (!keyEntry) return false;
        const p = PROVIDERS[keyEntry.provider];
        if (!p || !p.supportsVision) return false;
        const m = (keyEntry.model || '').toLowerCase();
        if (/gpt-4o|gpt-4-turbo|gpt-4-vision/.test(m)) return true;
        if (/claude-3/.test(m)) return true;
        if (/gemini/.test(m)) return true;
        return false;
    }
    function findVisionKey() {
        const keys = (SETTINGS.keys || []).filter(k => k.enabled !== false);
        const active = getActiveKey();
        if (active && providerSupportsVision(active)) return active;
        for (const k of keys) if (providerSupportsVision(k)) return k;
        return null;
    }

    // ============================================================
    // MODEL ROUTER
    // ============================================================
    const ROUTING_RULES = {
        mcq: [/gpt-oss-20b/i, /llama-3\.1-8b/i, /gemini-1\.5-flash-8b/i],
        fill: [/gpt-oss-20b/i, /gemini-2\.0-flash/i, /llama-3\.1-8b/i],
        calc: [/gpt-oss-120b/i, /deepseek-chat/i, /llama-3\.3-70b/i],
        multipart: [/claude-3-5-sonnet/i, /gpt-4o/i, /llama-3\.3-70b/i],
        essay: [/claude-3-5-sonnet/i, /gpt-4o/i],
        unknown: [/gpt-oss-120b/i, /llama-3\.3-70b/i, /gemini-2\.0-flash/i]
    };
    function pickBestKeyForRule(rule, usedIds) {
        const keys = (SETTINGS.keys || []).filter(k => k.enabled !== false && !usedIds.has(k.id));
        if (keys.length === 0) return null;
        for (const pattern of rule) for (const k of keys) if (pattern.test(k.model || '')) return k;
        return keys[0];
    }
    function routerSelectKeys(questionText, count) {
        const qType = detectQuestionType(questionText);
        const rule = ROUTING_RULES[qType] || ROUTING_RULES.unknown;
        const usedIds = new Set();
        const chosen = [];
        for (let i = 0; i < count; i++) { const k = pickBestKeyForRule(rule, usedIds); if (k) { usedIds.add(k.id); chosen.push(k); } }
        while (chosen.length < count) { const a = getActiveKey(); if (a) chosen.push(a); else break; }
        return chosen;
    }

    // ============================================================
    // SMART CACHE
    // ============================================================
    const CACHE_KEY = 'auto_chat_cache_v1';
    let CACHE_STATE = null;
    function loadCache() {
        if (CACHE_STATE) return CACHE_STATE;
        try { const raw = GM_getValue(CACHE_KEY, ''); CACHE_STATE = raw ? JSON.parse(raw) : { entries: {}, hits: 0, misses: 0 }; }
        catch (e) { CACHE_STATE = { entries: {}, hits: 0, misses: 0 }; }
        return CACHE_STATE;
    }
    function saveCache() { if (!CACHE_STATE) return; try { GM_setValue(CACHE_KEY, JSON.stringify(CACHE_STATE)); } catch (e) {} }
    function normalizeForCache(text) { if (!text) return ''; return text.substring(0, 500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
    function hashQuestion(text) { const s = normalizeForCache(text); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
    function hashMessage(text) { const s = String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim(); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return `${s.length}-${(h >>> 0).toString(36)}`; }
    function tokenizeForSim(text) { const s = normalizeForCache(text); return s ? new Set(s.split(' ').filter(w => w.length >= 2)) : new Set(); }
    function jaccardSimilarity(a, b) { if (a.size === 0 || b.size === 0) return 0; let inter = 0; for (const w of a) if (b.has(w)) inter++; const u = a.size + b.size - inter; return u === 0 ? 0 : inter / u; }
    const isCacheOn = () => SETTINGS.cacheEnabled !== 'off';
    const isCacheFuzzyOn = () => SETTINGS.cacheFuzzy !== 'off';
    const getCacheTTL = () => parseInt(SETTINGS.cacheTTL, 10) || 7;
    const getCacheMax = () => parseInt(SETTINGS.cacheMax, 10) || 500;
    const getCacheMinConfidence = () => parseInt(SETTINGS.cacheMinConfidence, 10) || 6;
    const isCacheShowHitOn = () => SETTINGS.cacheShowHit !== 'off';

    function cacheLookup(question) {
        if (!isCacheOn() || !question) return { hit: false };
        const cache = loadCache();
        const now = Date.now();
        const ttlMs = getCacheTTL() * 24 * 60 * 60 * 1000;
        const hash = hashQuestion(question);
        if (cache.entries[hash]) {
            const entry = cache.entries[hash];
            if (now - entry.timestamp <= ttlMs) { entry.hits++; entry.lastUsed = now; saveCache(); return { hit: true, hitType: 'exact', answer: entry.answer, subject: entry.subject, entry }; }
            else { delete cache.entries[hash]; saveCache(); }
        }
        if (!isCacheFuzzyOn()) return { hit: false };
        const queryTokens = tokenizeForSim(question);
        if (queryTokens.size < 3) return { hit: false };
        let best = null, bestSim = 0;
        for (const [, entry] of Object.entries(cache.entries)) {
            if (now - entry.timestamp > ttlMs) continue;
            const sim = jaccardSimilarity(queryTokens, tokenizeForSim(entry.question));
            if (sim > bestSim) { bestSim = sim; best = entry; }
        }
        if (best && bestSim >= 0.85) { best.hits++; best.lastUsed = now; saveCache(); return { hit: true, hitType: `fuzzy ${(bestSim*100).toFixed(0)}%`, answer: best.answer, subject: best.subject, entry: best }; }
        return { hit: false };
    }
    function cacheStore(question, answer, subject, confidence) {
        if (!isCacheOn() || !question || !answer || answer.startsWith('❌') || answer.length < 3) return;
        if (confidence !== null && confidence !== undefined && confidence < getCacheMinConfidence()) return;
        const cache = loadCache();
        const hash = hashQuestion(question);
        cache.entries[hash] = { question: question.substring(0, 500), answer, subject: subject || 'generic', confidence, timestamp: Date.now(), lastUsed: Date.now(), hits: (cache.entries[hash]?.hits || 0) + 1 };
        const max = getCacheMax();
        const keys = Object.keys(cache.entries);
        if (keys.length > max) { keys.sort((a, b) => cache.entries[a].lastUsed - cache.entries[b].lastUsed); for (let i = 0; i < keys.length - max; i++) delete cache.entries[keys[i]]; }
        saveCache();
    }
    function cachePrune() { const cache = loadCache(); const now = Date.now(); const ttlMs = getCacheTTL() * 24 * 60 * 60 * 1000; let r = 0; for (const [h, e] of Object.entries(cache.entries)) { if (now - e.timestamp > ttlMs) { delete cache.entries[h]; r++; } } if (r > 0) saveCache(); return r; }
    function cacheClear() { CACHE_STATE = { entries: {}, hits: 0, misses: 0 }; saveCache(); }
    function cacheStats() {
        const cache = loadCache();
        const entries = Object.values(cache.entries);
        const totalHits = entries.reduce((s, e) => s + (e.hits || 0), 0);
        const now = Date.now();
        const ttlMs = getCacheTTL() * 24 * 60 * 60 * 1000;
        const valid = entries.filter(e => now - e.timestamp <= ttlMs);
        const bySubject = {};
        for (const e of valid) { const s = e.subject || 'generic'; bySubject[s] = (bySubject[s] || 0) + 1; }
        return { total: entries.length, valid: valid.length, expired: entries.length - valid.length, totalHits, bySubject };
    }

    // ============================================================
    // SANITIZERS
    // ============================================================
    const stripDiacritics = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    const forceNoDiacritic = t => t ? t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') : t;

    function sanitizeUiChrome(text) {
        if (!text) return text;
        const cleaned = text.split('\n').filter(line => {
            const t = line.trim();
            if (!t) return true;

            if (/^[🧠🤖✨💡📝🎯✅❌🔍📊\s]*(đã|da)\s*chấm\s*(bằng|bang)\s*AI\b/i.test(t)) return false;
            if (/chấm\s*(bằng|bang)\s*AI\b/i.test(t)) return false;

            if (/^[⚡🔥💾🗃️📦🧠\s]*(đã|da)\s*dùng\s*bộ\s*(nhớ\s*)?đệm\b/i.test(t)) return false;
            if (/^\s*(đã|da)\s*dùng\s*bộ\s*(nhớ\s*)?đệm\s*[.!]?\s*$/i.test(t)) return false;
            if (/\bdùng\s*bộ\s*(nhớ\s*)?đệm\b/i.test(t) && t.length < 80) return false;

            if (/đã\s*tăng\s*tốc/i.test(t)) return false;
            if (/^[⚡🚀\s]*cache\s*(hit|từ|from)/i.test(t)) return false;
            if (/^(từ|cached\s*từ|loaded\s*from)\s*cache/i.test(t)) return false;
            if (/^[⚡🚀]\s*tăng\s*tốc/i.test(t)) return false;

            if (/^INT\s*:\s*[A-Z0-9_\-]+$/i.test(t)) return false;
            if (/^INT\s*:\s*[A-Z0-9_\-]+/i.test(t)) return false;
            if (/^\[?(INT|SYS|SYS_|META)\s*:\s*[A-Z0-9_\-]+\]?$/i.test(t)) return false;
            if (/^Feedback$/i.test(t)) return false;

            if (/^\d{1,2}:\d{2}:\d{2}\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(t)) return false;
            if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}[,\s]+\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return false;

            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return false;
            if (/^[0-9a-f]{24,}$/i.test(t) && /[a-f]/i.test(t)) return false;
            if (/^[0-9a-f\-]{20,}\s*$/i.test(t) && /[a-f]/i.test(t)) return false;

            return true;
        }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        return cleaned;
    }
    function sanitizeIds(text) {
        if (!text || !isFilterIdsOn()) return text;
        let c = text;
        c = c.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
        c = c.replace(/\b[0-9a-f]{24}\b/gi, m => /[a-f]/i.test(m) ? '' : m);
        c = c.replace(/\b[0-9a-f]{20,40}\b/gi, m => /[a-f]/i.test(m) ? '' : m);
        c = c.replace(/[0-9a-f]{24,}/gi, m => /[a-f]/i.test(m) ? '' : m);
        c = c.replace(/\s+[0-9a-f]{20,}\s+/gi, ' ');

        c = c.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(l => l.length > 0).join('\n')
            .replace(/\(\s*\)/g, '')
            .replace(/\[\s*\]/g, '')
            .replace(/\{\s*\}/g, '');
        c = c.split('\n').map(l => l.replace(/^[\s,;:]+|[\s,;:]+$/g, '')).filter(l => l.length > 0).join('\n')
            .replace(/\n{3,}/g, '\n\n').trim();

        c = c.split('\n').filter(l => l.replace(/[\s\.,;:!?\-—–]+/g, '').length > 0).join('\n');

        if (!c) return '❌ Không có nội dung sau khi lọc.';
        return c;
    }
    const sanitizeQuestion = t => sanitizeIds(sanitizeUiChrome(t));

    const REPLY_PREFIX_PATTERNS = [
        /^\s*(trả\s*lời|tra\s*loi|tl)\s*[:：]\s*/i,
        /^\s*(đáp\s*án|dap\s*an|đa|da)\s*[:：]\s*/i,
        /^\s*(answer|ans|reply)\s*[:：]\s*/i,
        /^\s*(kết\s*quả|ket\s*qua)\s*[:：]\s*/i
    ];
    function stripReplyPrefix(text) {
        if (!text || !isStripPrefixOn()) return text;
        let c = text;
        for (const re of REPLY_PREFIX_PATTERNS) { const b = c; c = c.replace(re, ''); if (c !== b) return c.trim(); }
        return c;
    }
    function sanitizeDegreeSymbol(text) {
        if (!text || !text.includes('°')) return text;
        const rep = SETTINGS.notation === 'vietnamese' ? ' độ' : ' degree';
        return text.replace(/°\s*/g, rep + ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?)\]])/g, '$1');
    }

    const SUPER_DIGIT_MAP = { '\u2070':'0','\u00B9':'1','\u00B2':'2','\u00B3':'3','\u2074':'4','\u2075':'5','\u2076':'6','\u2077':'7','\u2078':'8','\u2079':'9' };
    const SUB_DIGIT_MAP = { '\u2080':'0','\u2081':'1','\u2082':'2','\u2083':'3','\u2084':'4','\u2085':'5','\u2086':'6','\u2087':'7','\u2088':'8','\u2089':'9' };
    const GREEK_SYMBOLS = { 'ω':'omega','α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta','η':'eta','θ':'theta','ι':'iota','κ':'kappa','λ':'lambda','μ':'mu','ν':'nu','ξ':'xi','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','υ':'upsilon','φ':'phi','χ':'chi','ψ':'psi','Ω':'Omega','Δ':'Delta','Γ':'Gamma','Θ':'Theta','Λ':'Lambda','Ξ':'Xi','Π':'Pi','Σ':'Sigma','Φ':'Phi','Ψ':'Psi' };

    function sanitizeChemSymbols(text) {
        if (!text) return text;
        const mode = SETTINGS.chemNotation;
        if (mode === 'symbols' || mode === 'random' || !mode) return text;
        let out = text;
        out = out.replace(/([\u2070\u00B9\u00B2\u00B3\u2074-\u2079]*)([\u207A\u207B])/g, (m, digits, sign) => {
            const d = digits.replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]/g, ch => SUPER_DIGIT_MAP[ch] || '');
            return d ? `${d}${sign === '\u207A' ? '+' : '-'}` : (sign === '\u207A' ? '+' : '-');
        });
        out = out.replace(/[\u2080-\u2089]/g, ch => SUB_DIGIT_MAP[ch] || ch);
        if (mode === 'vietnamese') {
            out = out.replace(/⇌/g, ' thuận nghịch ').replace(/→/g, ' tạo thành ').replace(/←/g, ' từ ');
            out = out.replace(/([A-Z][A-Za-z0-9]*(?:\([^)]*\))?)\s*(\d)\s*\+/g, (m, tok, num) => /^[A-Z][a-z]?/.test(tok) ? `${tok} ${num} cộng` : m);
            out = out.replace(/([A-Z][A-Za-z0-9]*(?:\([^)]*\))?)\s*(\d)\s*-/g, (m, tok, num) => /^[A-Z][a-z]?/.test(tok) ? `${tok} ${num} trừ` : m);
            out = out.replace(/([A-Z][a-z]?)\s*\+/g, '$1 cộng').replace(/([A-Z][a-z]?)\s*-/g, '$1 trừ');
        } else {
            out = out.replace(/⇌/g, '<=>').replace(/→/g, '->').replace(/←/g, '<-');
        }
        return out.replace(/\s{2,}/g, ' ').trim();
    }

    function sanitizePhysicsSymbols(text) {
        if (!text) return text;
        const mode = SETTINGS.physicsNotation;
        if (mode === 'symbols' || mode === 'random' || !mode) return text;
        let out = text;
        if (mode === 'vietnamese') {
            out = out.replace(/√\s*\(([^)]+)\)/g, 'căn của ($1)').replace(/√\s*([A-Za-z][A-Za-z0-9₀-₉²³ₘₐₓᵢₙ]*)/g, 'căn của $1');
            out = out.replace(/([A-Za-z0-9\)])\s*²/g, '$1 mũ 2').replace(/([A-Za-z0-9\)])\s*³/g, '$1 mũ 3').replace(/([A-Za-z0-9\)])\s*\^([0-9]+)/g, '$1 mũ $2');
            out = out.replace(/([A-Za-z])ₘₐₓ/g, '$1 cực đại').replace(/([A-Za-z])ₘᵢₙ/g, '$1 cực tiểu').replace(/([A-Za-z])₀/g, '$1 không');
            out = out.replace(/±/g, 'cộng trừ').replace(/·/g, ' nhân ').replace(/×/g, ' nhân ').replace(/(\S)\s*\/\s*(\S)/g, '$1 chia $2');
        } else {
            out = out.replace(/√\s*\(([^)]+)\)/g, 'sqrt($1)').replace(/√\s*([A-Za-z][A-Za-z0-9₀-₉]*)/g, 'sqrt($1)');
            out = out.replace(/([A-Za-z0-9\)])\s*²/g, '$1^2').replace(/([A-Za-z0-9\)])\s*³/g, '$1^3');
            out = out.replace(/([A-Za-z])ₘₐₓ/g, '$1_max').replace(/([A-Za-z])ₘᵢₙ/g, '$1_min').replace(/([A-Za-z])₀/g, '$1_0');
            out = out.replace(/±/g, '+/-').replace(/·/g, '*').replace(/×/g, '*');
        }
        for (const [sym, name] of Object.entries(GREEK_SYMBOLS)) out = out.split(sym).join(' ' + name + ' ');
        return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').trim();
    }

    function sanitizeMathSymbols(text) {
        if (!text) return text;
        const mode = SETTINGS.notation;
        if (mode === 'symbols' || mode === 'random' || !mode) return text;
        let out = text;
        if (mode === 'vietnamese') {
            out = out.replace(/√\s*\(([^)]+)\)/g, 'căn của ($1)').replace(/√\s*([A-Za-z][A-Za-z0-9₀-₉²³]*)/g, 'căn của $1');
            out = out.replace(/([A-Za-z0-9\)])\s*²/g, '$1 mũ 2').replace(/([A-Za-z0-9\)])\s*³/g, '$1 mũ 3').replace(/([A-Za-z0-9\)])\s*\^([0-9]+)/g, '$1 mũ $2');
            out = out.replace(/π/g, 'pi').replace(/Δ/g, 'delta').replace(/±/g, 'cộng trừ').replace(/·/g, ' nhân ').replace(/×/g, ' nhân ').replace(/÷/g, ' chia ');
        } else {
            out = out.replace(/√\s*\(([^)]+)\)/g, 'sqrt($1)').replace(/√\s*([A-Za-z][A-Za-z0-9]*)/g, 'sqrt($1)');
            out = out.replace(/([A-Za-z0-9\)])\s*²/g, '$1^2').replace(/([A-Za-z0-9\)])\s*³/g, '$1^3');
            out = out.replace(/π/g, 'pi').replace(/Δ/g, 'delta').replace(/±/g, '+/-').replace(/·/g, '*').replace(/×/g, 'x').replace(/÷/g, '/');
        }
        return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').trim();
    }

    function applySlang(text, level) {
        if (!text || !level || level === 'none') return text;
        const dict = SLANG_DICTS[level] || [];
        if (dict.length === 0) return text;
        let out = text;
        for (const [from, to] of dict) {
            const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(?<!\\p{L})${escaped.replace(/\s+/g, '\\s+')}(?!\\p{L})`, 'giu');
            out = out.replace(re, match => { const f = match.charAt(0); return (f === f.toUpperCase() && f !== f.toLowerCase()) ? to.charAt(0).toUpperCase() + to.slice(1) : to; });
        }
        return out;
    }

    // ============================================================
    // LESSON END / CONFIDENCE / SUBJECT
    // ============================================================
    const END_KEYWORDS = [
        'hẹn gặp em ở buổi học tiếp theo',
        'chúc mừng em hoàn thành buổi học!',
        'see you in the next lesson',
        'congratulations on completing the lesson',
        'you have completed the lesson'
    ];
    const END_REGEXES = [
        /hẹn\s+gặp\s+(em|bạn).{0,20}(buổi|bài|chặng)/i,
        /chúc\s+mừng.{0,30}hoàn\s+thành\s+(buổi|kho[áa]|chặng)/i,
        /đã\s+hoàn\s+thành.{0,20}(buổi\s+học|bài\s+học|chặng\s+cuối)/i,
        /kết\s+thúc\s+(buổi\s+học|bài\s+học|kho[áa]|chặng)/i,
        /see\s+you\s+in\s+the\s+next\s+(lesson|session|class)/i,
        /congratulations.{0,30}(completing|finishing)\s+the\s+(lesson|session|course|unit)/i,
        /you\s+(have|'ve)\s+(completed|finished)\s+(the|this)\s+(lesson|session|unit)/i
    ];
    const END_KEYWORDS_NO_DIA = ['hen gap em o buoi hoc tiep theo', 'chuc mung em hoan thanh buoi hoc!'];

    function looksLikeNewQuestion(text) {
        if (!text) return false;
        const q = text.includes('Câu hỏi') || text.includes('Hãy trả lời') || /\bQuestion\b/i.test(text) || /Please try the exercise/i.test(text);
        const a = text.includes('Trả lời:') || text.includes('trả lời theo') || text.includes('điền đáp án') || /\bAnswer\s*:/i.test(text) || /Use this answer format/i.test(text);
        return q && a;
    }
    function isLessonEnded(text) {
        if (!text) return false;
        if (/chúc mừng.{0,60}(?:hoàn thành|kết thúc).{0,40}(?:buổi học|bài học|khóa học)|(?:buổi học|bài học|khóa học).{0,40}(?:đã hoàn thành|đã kết thúc)|congratulations.{0,80}(?:completed|finished).{0,60}(?:lesson|session|course)/i.test(text)) return true;
        if (looksLikeNewQuestion(text)) return false;
        const lower = text.toLowerCase();
        for (const kw of END_KEYWORDS) if (lower.includes(kw)) return true;
        const lowerNoDia = stripDiacritics(lower);
        for (const kw of END_KEYWORDS_NO_DIA) if (lowerNoDia.includes(kw)) return true;
        for (const re of END_REGEXES) if (re.test(text)) return true;
        return false;
    }

    function parseConfidence(text) {
        if (!text) return { content: text, confidence: null };
        const re = /\[CONFIDENCE\s*:\s*(\d{1,2})(?:\s*\/\s*10)?\s*\]/gi;
        let confidence = null;
        const cleaned = text.replace(re, (m, n) => { const v = parseInt(n, 10); if (!Number.isNaN(v) && v >= 0 && v <= 10) confidence = v; return ''; }).replace(/\n{3,}/g, '\n\n').trim();
        return { content: cleaned, confidence };
    }
    function detectSubject(text) {
        if (!text || !isSubjectDetectionOn()) return 'generic';
        const t = text.substring(0, 3000);
        const scores = {};
        for (const [s, patterns] of Object.entries(SUBJECT_KEYWORDS)) { scores[s] = 0; for (const re of patterns) { const m = t.match(re); if (m) scores[s] += m.length; } }
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0 || sorted[0][1] < 2) return 'generic';
        if (sorted[1] && sorted[1][1] > 0 && sorted[0][1] - sorted[1][1] < 2) return 'generic';
        return sorted[0][0];
    }
    function shouldApplyMathNotation(s) {
        if (s === 'english') return false;
        if (!isSubjectDetectionOn()) return true;
        return s !== 'chemistry' && s !== 'literature' && s !== 'english' && s !== 'physics' && s !== 'economics';
    }
    function shouldApplyChemNotation(s) {
        if (s === 'english') return false;
        if (!isSubjectDetectionOn()) return true;
        return s === 'chemistry';
    }
    function shouldApplyPhysicsNotation(s) {
        if (s === 'english') return false;
        if (!isSubjectDetectionOn()) return false;
        return s === 'physics';
    }
    function normalizeAnswerForVote(text) {
        if (!text) return '__EMPTY__';
        let s = String(text).trim();
        if (s.startsWith('❌')) return '__ERROR__';
        const mcq = s.match(/^\s*([A-D])\s*[\.\)]\s*/i);
        if (mcq) return mcq[1].toUpperCase();
        s = s.toLowerCase().replace(/[.,;:!?]+$/g, '').replace(/\s+/g, ' ').trim();
        return s.length > 40 ? s.substring(0, 40) : s;
    }
    function isLikelyEnglish(text) {
        if (!text || text.length < 15) return false;
        const sample = text.substring(0, 1200);
        if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(sample)) return false;
        let prose = sample
            .replace(/\b[A-Z][a-z]?\d*(?:\s*[+-])?\b/g, ' ')
            .replace(/\b(?:pH|pOH|mol|M|SI)\b/g, ' ')
            .replace(/[²³¹⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⁺⁻√πΔΣ∫∞±≤≥≠αβγδεζηθικλμνξοπρστυφχψωΩΓΘΛΞΠΦΨ]/g, ' ')
            .replace(/\b[a-zA-Z]_[a-zA-Z0-9]+\b/g, ' ')
            .replace(/[·×÷≈→←⇌↔=<>+\-*/()\[\]{}]/g, ' ')
            .replace(/\b\d+(?:[.,]\d+)?\b/g, ' ')
            .replace(/\b(?:kg|mg|mL|mol|Hz|Pa|rad)\b/g, ' ')
            .replace(/(?<![a-zA-Z])[msgNJWVAK](?![a-zA-Z])/g, ' ')
            .replace(/\s+/g, ' ').trim();
        if (prose.length < 25) return false;
        const words = prose.split(/\s+/).filter(w => w.length >= 2);
        if (words.length < 5) return false;
        const SIG = new Set(['the','is','are','was','were','be','been','being','this','that','these','those','it','its','they','them','their','we','us','our','you','your','can','will','would','should','could','must','may','might','have','has','had','do','does','did','get','got','make','made','see','saw','say','said','use','used','find','found','need','needs','calculate','compute','determine','solve','simplify','derive','substitute','consider','assume','suppose','notice','observe','check','verify','and','or','but','not','with','from','by','as','for','in','on','at','to','of','because','therefore','thus','hence','so','then','also','just','only','very','first','second','third','finally','next','now','here','there','when','where','while','answer','result','value','equation','solution','reaction','concentration','product','mole','acid','base','salt','ion','atom','molecule','compound','element','balanced','unbalanced','aqueous','precipitate','spectator','acidic','basic','neutral']);
        let enCount = 0;
        for (const w of words) { const c = w.toLowerCase().replace(/[^a-z]/g, ''); if (c && SIG.has(c)) enCount++; }
        return enCount >= 3 && (enCount / words.length) >= 0.25;
    }

    function setStatus(state) {
        const chip = document.getElementById('ac-status-chip');
        if (!chip) return;
        const s = STATUS_STATES[state] || STATUS_STATES.idle;
        const subjLabel = (isSubjectDetectionOn() && lastSubject && lastSubject !== 'generic') ? ` [${SUBJECT_EMOJI[lastSubject]} ${lastSubject}]` : '';
        chip.style.color = s.color;
        chip.title = `Auto Chat: ${s.label}${subjLabel}`;
        const iconEl = chip.querySelector('#ac-status-icon');
        if (iconEl) iconEl.textContent = s.icon;
        const ex = chip.querySelector('.ac-chip-pulse');
        if (ex) ex.remove();
        if (s.pulse) { const ring = document.createElement('span'); ring.className = 'ac-chip-pulse'; chip.appendChild(ring); }
    }

    function recordRejection(question, answer, attempts, confidence) {
        if (!question) return;
        const qKey = question.substring(0, 200).replace(/\n/g, ' ').trim();
        const existing = rejectedQA.find(r => r.question === qKey);
        if (existing) { existing.answer = answer || existing.answer; existing.attempts = attempts || existing.attempts; if (confidence !== null && confidence !== undefined) existing.confidence = confidence; existing.time = Date.now(); }
        else rejectedQA.push({ question: qKey, answer: answer || '', attempts: attempts || 1, confidence: (confidence !== null && confidence !== undefined) ? confidence : null, time: Date.now() });
        try { const cache = loadCache(); const h = hashQuestion(qKey); if (cache.entries[h]) { delete cache.entries[h]; saveCache(); } } catch (e) {}
    }
    function renderFlashcardsHtml() {
        if (rejectedQA.length === 0) return `<div style="padding:40px 20px;text-align:center;color:#94a3b8;font-size:13px;"><div style="font-size:36px;margin-bottom:10px;">🎉</div><div style="font-weight:600;color:#64748b;">Không có câu nào bị từ chối</div></div>`;
        return rejectedQA.map((c, i) => {
            const conf = (c.confidence !== null && c.confidence !== undefined) ? `<span style="margin-left:auto;font-size:11px;font-weight:600;color:${c.confidence >= 7 ? '#059669' : c.confidence >= 5 ? '#f59e0b' : '#dc2626'};">Confidence ${c.confidence}/10</span>` : '';
            return `<div style="margin-bottom:14px;padding:14px 16px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="background:#6366f1;color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">#${i+1}</span><span style="font-size:11px;color:#64748b;">${c.attempts} lần thử · ${new Date(c.time).toLocaleTimeString('vi-VN')}</span>${conf}</div><div style="font-size:12.5px;color:#334155;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin-bottom:10px;"><div style="font-weight:700;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Câu hỏi</div>${escapeHtml(c.question)}</div><div style="font-size:12.5px;color:#0f172a;line-height:1.55;white-space:pre-wrap;word-break:break-word;padding:10px 12px;background:#ecfdf5;border-radius:8px;border-left:3px solid #059669;"><div style="font-weight:700;color:#059669;font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Đáp án cuối</div>${escapeHtml(c.answer) || '<i style="color:#94a3b8;">(chưa nộp)</i>'}</div></div>`;
        }).join('');
    }

    // ============================================================
    // STYLES
    // ============================================================
    function injectStyles() {
        if (document.getElementById('ac-styles')) return;
        const style = document.createElement('style');
        style.id = 'ac-styles';
        style.textContent = `
.ac-root, #ac-button-bar, .ac-dialog-overlay, .ac-dialog, .ac-toast-container, .ac-toast, #ac-status-chip, #ac-activity-panel {
    --ac-primary:#6366f1; --ac-primary-hover:#4f46e5; --ac-primary-soft:#eef2ff;
    --ac-bg:#fff; --ac-bg-subtle:#f8fafc; --ac-bg-muted:#f1f5f9;
    --ac-border:#e2e8f0; --ac-border-strong:#cbd5e1;
    --ac-text:#0f172a; --ac-text-muted:#64748b; --ac-text-soft:#94a3b8;
    --ac-shadow-sm: 0 1px 2px rgba(15,23,42,0.05);
    --ac-shadow-md: 0 4px 16px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.04);
    --ac-shadow-lg: 0 24px 72px rgba(15,23,42,0.22), 0 4px 12px rgba(15,23,42,0.08);
    --ac-radius-sm:8px; --ac-radius-md:11px; --ac-radius-lg:18px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "cv11", "ss01";
}
#ac-button-bar { position:fixed; top:16px; right:16px; z-index:99999; display:flex; flex-direction:row-reverse; align-items:center; gap:6px; padding:6px; background:rgba(255,255,255,0.94); backdrop-filter:saturate(180%) blur(16px); -webkit-backdrop-filter:saturate(180%) blur(16px); border:1px solid rgba(226,232,240,0.9); border-radius:15px; box-shadow:var(--ac-shadow-md); pointer-events:none; max-width: calc(100vw - 32px); overflow-x:auto; scrollbar-width:none; }
#ac-button-bar::-webkit-scrollbar { display:none; }
#ac-button-bar.ac-hidden { display:none; }
#ac-button-bar button { height:36px; padding:0 14px; border:none; border-radius:10px; font-size:13px; font-weight:600; letter-spacing:-0.01em; cursor:pointer; display:inline-flex; align-items:center; gap:6px; color:#fff; transition: transform 0.14s cubic-bezier(0.16,1,0.3,1), box-shadow 0.15s ease, filter 0.15s ease; pointer-events:auto; white-space:nowrap; flex:0 0 auto; }
#ac-button-bar button:hover { transform:translateY(-1.5px); box-shadow:0 6px 16px rgba(15,23,42,0.16); filter:brightness(1.06); }
#ac-button-bar button:active { transform:translateY(0.5px); filter:brightness(0.94); }
#ac-button-bar #auto-chat-btn::before { content:''; width:7px; height:7px; border-radius:50%; background:currentColor; opacity:0.55; flex-shrink:0; transition: opacity 0.2s, box-shadow 0.2s; }
#ac-button-bar #auto-chat-btn.ac-on::before { opacity:1; box-shadow:0 0 0 3px rgba(255,255,255,0.3); animation: ac-pulse 2s ease-in-out infinite; }
@keyframes ac-pulse { 0%,100%{box-shadow:0 0 0 3px rgba(255,255,255,0.3);} 50%{box-shadow:0 0 0 6px rgba(255,255,255,0.12);} }
.ac-dialog-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(10px) saturate(120%); -webkit-backdrop-filter:blur(10px) saturate(120%); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px; animation: ac-fade 0.2s ease; }
@keyframes ac-fade { from{opacity:0;} to{opacity:1;} }
.ac-dialog { background:var(--ac-bg); border-radius:var(--ac-radius-lg); width:100%; display:flex; flex-direction:column; max-height:92vh; box-shadow:var(--ac-shadow-lg); overflow:hidden; animation: ac-rise 0.26s cubic-bezier(0.16,1,0.3,1); border:1px solid rgba(226,232,240,0.6); }
@keyframes ac-rise { from{opacity:0;transform:translateY(14px) scale(0.97);} to{opacity:1;transform:translateY(0) scale(1);} }
.ac-dialog-header { padding:20px 24px 16px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--ac-bg-muted); flex-shrink:0; background:linear-gradient(180deg, #ffffff 0%, #fafbfc 100%); }
.ac-dialog-title { margin:0; font-size:16px; font-weight:700; color:var(--ac-text); letter-spacing:-0.025em; display:flex; align-items:center; gap:9px; }
.ac-dialog-title > span:first-child { font-size:18px; }
.ac-dialog-subtitle { font-size:12px; color:var(--ac-text-muted); margin:5px 0 0; font-weight:400; line-height:1.4; }
.ac-dialog-close { width:34px; height:34px; border-radius:9px; border:none; background:transparent; color:var(--ac-text-muted); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:20px; line-height:1; transition: background 0.15s, color 0.15s, transform 0.15s; flex-shrink:0; }
.ac-dialog-close:hover { background:var(--ac-bg-muted); color:var(--ac-text); transform:rotate(90deg); }
.ac-dialog-body { padding:20px 24px 24px; overflow-y:auto; flex:1; }
.ac-dialog-body::-webkit-scrollbar { width:9px; }
.ac-dialog-body::-webkit-scrollbar-track { background:transparent; }
.ac-dialog-body::-webkit-scrollbar-thumb { background:#d1d9e3; border-radius:5px; border:2.5px solid transparent; background-clip:padding-box; }
.ac-dialog-body::-webkit-scrollbar-thumb:hover { background:#94a3b8; background-clip:padding-box; border:2.5px solid transparent; }
.ac-dialog-footer { padding:14px 24px; border-top:1px solid var(--ac-bg-muted); background:linear-gradient(0deg, #fafbfc 0%, #ffffff 100%); display:flex; gap:8px; justify-content:flex-end; flex-shrink:0; flex-wrap:wrap; align-items:center; }
.ac-tabs-wrapper { position:relative; background:#fafbfc; border-bottom:1px solid var(--ac-bg-muted); flex-shrink:0; }
.ac-tabs-wrapper::before,
.ac-tabs-wrapper::after { content:''; position:absolute; top:0; bottom:0; width:40px; pointer-events:none; z-index:2; opacity:0; transition:opacity 0.22s ease; }
.ac-tabs-wrapper.ac-can-scroll-left::before { opacity:1; left:0; background:linear-gradient(90deg, #fafbfc 40%, transparent); }
.ac-tabs-wrapper.ac-can-scroll-right::after { opacity:1; right:0; background:linear-gradient(270deg, #fafbfc 40%, transparent); }
.ac-tabs { display:flex; gap:2px; padding:8px 14px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; -ms-overflow-style:none; scroll-behavior:smooth; }
.ac-tabs::-webkit-scrollbar { display:none; }
.ac-tab { padding:8px 14px; border:none; background:transparent; border-radius:9px; cursor:pointer; font-size:12.5px; font-weight:600; color:var(--ac-text-muted); white-space:nowrap; transition: background 0.15s ease, color 0.15s ease, box-shadow 0.18s ease; display:inline-flex; align-items:center; gap:6px; margin:0; font-family:inherit; flex-shrink:0; }
.ac-tab:hover { background:#eef2f6; color:var(--ac-text); }
.ac-tab.ac-tab-active { background:var(--ac-primary); color:#fff; box-shadow:0 3px 10px rgba(99,102,241,0.32); }
.ac-tab.ac-tab-active:hover { background:var(--ac-primary-hover); }
.ac-tabs-arrow { position:absolute; top:50%; transform:translateY(-50%); z-index:3; width:26px; height:26px; border-radius:50%; background:#fff; border:1px solid var(--ac-border); color:var(--ac-text-muted); cursor:pointer; display:none; align-items:center; justify-content:center; font-size:14px; font-weight:700; line-height:1; box-shadow:0 3px 8px rgba(15,23,42,0.1); transition: background 0.15s, color 0.15s, transform 0.15s, border-color 0.15s; padding:0; padding-bottom:2px; }
.ac-tabs-wrapper.ac-can-scroll-left .ac-tabs-arrow.ac-tabs-arrow-left { display:flex; }
.ac-tabs-wrapper.ac-can-scroll-right .ac-tabs-arrow.ac-tabs-arrow-right { display:flex; }
.ac-tabs-arrow:hover { background:var(--ac-primary); color:#fff; border-color:var(--ac-primary); transform:translateY(-50%) scale(1.08); }
.ac-tabs-arrow:active { transform:translateY(-50%) scale(0.98); }
.ac-tabs-arrow-left { left:2px; }
.ac-tabs-arrow-right { right:2px; }
.ac-tab-panel { display:none; }
.ac-tab-panel.ac-tab-panel-active { display:block; animation: ac-panel-fade 0.2s ease; }
@keyframes ac-panel-fade { from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
.ac-btn { height:38px; padding:0 18px; border-radius:var(--ac-radius-md); font-size:13.5px; font-weight:600; cursor:pointer; transition: background 0.15s, border-color 0.15s, box-shadow 0.18s, transform 0.12s cubic-bezier(0.16,1,0.3,1); display:inline-flex; align-items:center; gap:6px; white-space:nowrap; font-family:inherit; }
.ac-btn:hover { transform:translateY(-1px); }
.ac-btn:active { transform:translateY(0.5px); }
.ac-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none !important; }
.ac-btn-secondary { background:#fff; color:#334155; border:1px solid var(--ac-border); box-shadow:var(--ac-shadow-sm); }
.ac-btn-secondary:hover { background:var(--ac-bg-subtle); border-color:var(--ac-border-strong); box-shadow:0 4px 10px rgba(15,23,42,0.06); }
.ac-btn-primary { background:var(--ac-primary); color:#fff; border:none; box-shadow:0 2px 6px rgba(99,102,241,0.32); }
.ac-btn-primary:hover { background:var(--ac-primary-hover); box-shadow:0 6px 16px rgba(99,102,241,0.4); }
.ac-btn-danger { background:#fff; color:#dc2626; border:1px solid #fecaca; }
.ac-btn-danger:hover { background:#fef2f2; border-color:#fca5a5; box-shadow:0 4px 10px rgba(220,38,38,0.1); }
.ac-section { margin-bottom:24px; }
.ac-section:last-child { margin-bottom:0; }
.ac-section-title { margin:0 0 6px; font-size:13px; font-weight:700; color:var(--ac-text); display:flex; align-items:center; gap:8px; letter-spacing:-0.01em; }
.ac-section-title .ac-section-emoji { font-size:16px; line-height:1; }
.ac-section-desc { margin:0 0 12px; font-size:12px; line-height:1.6; color:var(--ac-text-muted); }
.ac-section-desc code { font-family: ui-monospace, monospace; font-size:11px; background:var(--ac-bg-muted); padding:1.5px 6px; border-radius:5px; color:#334155; border:1px solid var(--ac-border); }
.ac-option { --ac-opt-accent:#6366f1; --ac-opt-bg:#eef2ff; display:flex; align-items:center; gap:12px; padding:11px 14px; margin-bottom:6px; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); background:#fff; cursor:pointer; transition: border-color 0.15s, background 0.15s, box-shadow 0.18s, transform 0.15s cubic-bezier(0.16,1,0.3,1); position:relative; }
.ac-option:last-child { margin-bottom:0; }
.ac-option:hover { border-color:var(--ac-border-strong); background:var(--ac-bg-subtle); transform:translateX(2px); }
.ac-option:has(input[type="radio"]:checked) { border-color:var(--ac-opt-accent); background:var(--ac-opt-bg); box-shadow:0 0 0 3px color-mix(in srgb, var(--ac-opt-accent) 9%, transparent), 0 2px 8px color-mix(in srgb, var(--ac-opt-accent) 12%, transparent); }
.ac-option:has(input[type="radio"]:checked):hover { transform:translateX(2px); }
.ac-option input[type="radio"] { appearance:none; -webkit-appearance:none; width:17px; height:17px; border:1.5px solid var(--ac-border-strong); border-radius:50%; margin:0; cursor:pointer; transition: border-color 0.15s, border-width 0.1s, box-shadow 0.15s; flex-shrink:0; background:#fff; }
.ac-option input[type="radio"]:checked { border-color:var(--ac-opt-accent); border-width:5px; box-shadow:0 0 0 1px var(--ac-opt-accent); }
.ac-option .ac-opt-label { font-size:13px; font-weight:600; color:var(--ac-text); flex:1; line-height:1.35; letter-spacing:-0.005em; }
.ac-option .ac-opt-desc { font-size:11.5px; color:var(--ac-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:55%; flex-shrink:0; line-height:1.35; }
.ac-input, .ac-textarea { width:100%; padding:0 14px; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); font-size:13px; color:var(--ac-text); background:#fff; box-sizing:border-box; transition: border-color 0.15s, box-shadow 0.15s; font-family:inherit; }
.ac-input { height:42px; }
select.ac-input { cursor:pointer; }
.ac-textarea { padding:11px 14px; line-height:1.55; resize:vertical; min-height:80px; outline:none; font-family:inherit; }
.ac-input:focus, .ac-textarea:focus { outline:none; border-color:var(--ac-primary); box-shadow:0 0 0 3.5px rgba(99,102,241,0.14); }
.ac-textarea::placeholder { color:var(--ac-text-soft); font-style:italic; }
.ac-info { display:flex; align-items:flex-start; gap:9px; padding:11px 13px; background:var(--ac-bg-subtle); border:1px solid var(--ac-border); border-radius:var(--ac-radius-md); font-size:12px; color:var(--ac-text-muted); line-height:1.55; }
.ac-info b { color:var(--ac-text); font-weight:600; }
.ac-info code { font-family: ui-monospace, monospace; font-size:11px; background:#fff; padding:1.5px 6px; border-radius:5px; border:1px solid #e2e8f0; color:#334155; }
.ac-status { margin-top:12px; font-size:12px; font-weight:500; min-height:16px; transition: color 0.15s; }
.ac-keybind-row { display:flex; align-items:flex-end; gap:10px; }
.ac-keybind-row + .ac-keybind-row { margin-top:12px; }
.ac-keybind-field { flex:1; min-width:0; }
.ac-keybind-label { display:block; font-size:12px; font-weight:600; color:var(--ac-text); margin-bottom:6px; }
.ac-keybind-input { height:42px; padding:0 14px; background:#fff; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); font-family: ui-monospace, monospace; font-size:12.5px; font-weight:600; color:var(--ac-text); display:flex; align-items:center; cursor:pointer; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; user-select:none; outline:none; }
.ac-keybind-input:hover { border-color:var(--ac-border-strong); }
.ac-keybind-input:focus { border-color:var(--ac-primary); box-shadow:0 0 0 3.5px rgba(99,102,241,0.14); }
.ac-keybind-input.ac-capturing { border-color:var(--ac-primary); box-shadow:0 0 0 3.5px rgba(99,102,241,0.2); background:#eef2ff; color:var(--ac-primary); }
.ac-keybind-input.ac-capturing::after { content:'⏳ Nhấn phím...'; margin-left:auto; font-weight:500; color:var(--ac-primary); font-size:12px; animation: ac-pulse-op 1.2s ease-in-out infinite; }
@keyframes ac-pulse-op { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
.ac-keybind-clear { height:42px !important; padding:0 14px !important; font-size:12.5px !important; }
.ac-summary-body { flex:1; overflow-y:auto; padding:16px 18px; background:var(--ac-bg-subtle); border:1px solid var(--ac-border); border-radius:var(--ac-radius-md); font-size:13px; line-height:1.65; color:var(--ac-text); white-space:pre-wrap; word-break:break-word; }
.ac-loading { display:flex; align-items:center; gap:10px; color:var(--ac-primary); font-weight:500; }
.ac-spinner { width:14px; height:14px; border:2px solid var(--ac-primary); border-top-color:transparent; border-radius:50%; animation: ac-spin 0.7s linear infinite; flex-shrink:0; }
@keyframes ac-spin { to{transform:rotate(360deg);} }
.ac-profile-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.ac-profile-btn { display:flex; align-items:center; gap:11px; padding:13px 15px; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); background:#fff; cursor:pointer; transition: border-color 0.15s, background 0.15s, transform 0.14s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s; text-align:left; font-family:inherit; }
.ac-profile-btn:hover { border-color:var(--ac-primary); background:var(--ac-primary-soft); transform:translateY(-2px); box-shadow:0 8px 20px rgba(99,102,241,0.16); }
.ac-profile-btn:active { transform:translateY(0); box-shadow:0 2px 6px rgba(99,102,241,0.12); }
.ac-profile-btn .ac-profile-emoji { font-size:22px; line-height:1; flex-shrink:0; }
.ac-profile-btn .ac-profile-info { display:flex; flex-direction:column; gap:3px; min-width:0; }
.ac-profile-btn .ac-profile-name { font-size:13px; font-weight:700; color:var(--ac-text); letter-spacing:-0.015em; }
.ac-profile-btn .ac-profile-desc { font-size:11px; color:var(--ac-text-muted); line-height:1.35; overflow:hidden; text-overflow:ellipsis; }
.ac-toast-container { position:fixed; bottom:22px; right:22px; z-index:1000000; display:flex; flex-direction:column; gap:9px; pointer-events:none; max-width:380px; }
.ac-toast { min-width:260px; max-width:380px; padding:13px 16px; border-radius:12px; background:#fff; color:#0f172a; font-size:13px; line-height:1.5; box-shadow: 0 12px 32px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.06); border-left:4px solid #6366f1; pointer-events:auto; animation: ac-toast-in 0.32s cubic-bezier(0.16,1,0.3,1); display:flex; align-items:flex-start; gap:11px; }
.ac-toast > span:last-child { white-space: pre-line; word-break: break-word; }
.ac-toast.ac-toast-out { animation: ac-toast-out 0.22s ease forwards; }
@keyframes ac-toast-in { from{opacity:0;transform:translateX(28px) scale(0.96);} to{opacity:1;transform:translateX(0) scale(1);} }
@keyframes ac-toast-out { to{opacity:0;transform:translateX(24px) scale(0.96);} }
.ac-toast-success { border-left-color:#059669; }
.ac-toast-warn { border-left-color:#f59e0b; }
.ac-toast-error { border-left-color:#dc2626; }
#ac-button-bar #changelog-btn { position:relative; }
#ac-button-bar #changelog-btn.ac-has-badge::after { content:''; position:absolute; top:1px; right:1px; width:10px; height:10px; background:#dc2626; border:2px solid #fff; border-radius:50%; box-shadow:0 0 0 1px rgba(220,38,38,0.4); animation: ac-badge-pulse 1.8s ease-in-out infinite; }
@keyframes ac-badge-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.18); } }
.ac-key-row { display:flex; align-items:center; gap:12px; padding:13px 15px; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); background:#fff; transition: border-color 0.15s, background 0.15s, box-shadow 0.18s; }
.ac-key-row:hover { border-color:var(--ac-border-strong); box-shadow:0 3px 10px rgba(15,23,42,0.05); }
.ac-key-row-active { border-color:var(--ac-primary); background:var(--ac-primary-soft); box-shadow:0 0 0 3px rgba(99,102,241,0.09); }
.ac-cache-row { padding:13px 15px; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); background:#fff; margin-bottom:9px; font-size:12.5px; transition: border-color 0.15s, box-shadow 0.18s; }
.ac-cache-row:hover { border-color:var(--ac-border-strong); box-shadow:0 3px 10px rgba(15,23,42,0.05); }
.ac-cache-row:last-child { margin-bottom:0; }
.ac-cache-q { font-weight:600; color:#0f172a; line-height:1.45; margin-bottom:7px; word-break:break-word; max-height:2.9em; overflow:hidden; }
.ac-cache-a { font-family: ui-monospace, monospace; font-size:11.5px; color:#059669; background:#ecfdf5; padding:7px 11px; border-radius:7px; white-space:pre-wrap; word-break:break-word; max-height:4em; overflow:hidden; border-left:2.5px solid #059669; }
.ac-stat-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:11px; margin-bottom:20px; }
.ac-stat-card { padding:15px 17px; border:1.5px solid var(--ac-border); border-radius:var(--ac-radius-md); background:#fff; transition: border-color 0.15s, box-shadow 0.18s, transform 0.15s; }
.ac-stat-card:hover { border-color:var(--ac-border-strong); box-shadow:0 4px 12px rgba(15,23,42,0.06); transform:translateY(-1px); }
.ac-stat-label { font-size:11px; text-transform:uppercase; color:var(--ac-text-muted); font-weight:700; letter-spacing:0.06em; margin-bottom:7px; }
.ac-stat-value { font-size:22px; font-weight:700; color:var(--ac-text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height:1.1; letter-spacing:-0.02em; }
.ac-stat-sub { font-size:11px; color:var(--ac-text-soft); margin-top:5px; }
.ac-model-row { display:flex; align-items:center; gap:12px; padding:11px 13px; border-bottom:1px solid var(--ac-bg-muted); font-size:12.5px; }
.ac-model-row:last-child { border-bottom:none; }
.ac-failed-row { padding:11px 13px; border:1.5px solid #fecaca; border-radius:var(--ac-radius-md); background:#fef2f2; margin-bottom:6px; font-size:12px; }
.ac-pg-panel { background:#f8fafc; border:1px solid var(--ac-border); border-radius:var(--ac-radius-md); padding:13px 15px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12.5px; line-height:1.6; white-space:pre-wrap; word-break:break-word; color:#0f172a; max-height:220px; overflow-y:auto; }
#ac-status-chip { position: fixed; top: 70px; right: 16px; z-index: 99998; width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.95); backdrop-filter: saturate(180%) blur(14px); -webkit-backdrop-filter: saturate(180%) blur(14px); border: 1px solid rgba(226,232,240,0.9); box-shadow: var(--ac-shadow-md); display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; user-select: none; transition: transform 0.18s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s ease; }
#ac-status-chip:hover { transform: scale(1.1); box-shadow: 0 8px 20px rgba(15,23,42,0.16); }
#ac-status-chip:active { transform: scale(1.02); }
#ac-status-chip.ac-chip-hidden { display: none; }
#ac-credit-badge { position: fixed; top: 73px; right: 60px; z-index: 99998; padding: 5px 12px; border-radius: 999px; background: rgba(255,255,255,0.94); backdrop-filter: saturate(180%) blur(14px); -webkit-backdrop-filter: saturate(180%) blur(14px); border: 1px solid rgba(226,232,240,0.9); box-shadow: var(--ac-shadow-sm); font-size: 11px; font-weight: 700; color: #4f46e5; letter-spacing: 0.01em; user-select: none; pointer-events: auto; display: inline-flex; align-items: center; gap: 6px; }
#ac-credit-badge.ac-chip-hidden { display: none; }
#ac-status-chip .ac-chip-pulse { position: absolute; inset: -3px; border-radius: 50%; border: 2px solid currentColor; opacity: 0; animation: ac-chip-pulse 1.6s ease-out infinite; pointer-events: none; }
@keyframes ac-chip-pulse { 0% { transform: scale(0.9); opacity: 0.55; } 100% { transform: scale(1.5); opacity: 0; } }
#ac-activity-panel { position: fixed; top: 114px; right: 16px; z-index: 99997; width: 380px; max-width: calc(100vw - 32px); max-height: 500px; background: rgba(255,255,255,0.97); backdrop-filter: saturate(180%) blur(16px); -webkit-backdrop-filter: saturate(180%) blur(16px); border: 1px solid rgba(226,232,240,0.9); border-radius: 15px; box-shadow: 0 12px 40px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06); display: flex; flex-direction: column; overflow: hidden; transition: transform 0.24s cubic-bezier(0.16,1,0.3,1), opacity 0.24s ease; }
#ac-activity-panel.ac-activity-hidden { transform: translateX(440px); opacity: 0; pointer-events: none; }
#ac-activity-panel .ac-act-header { padding: 11px 15px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(180deg, #ffffff, #fafbfc); flex-shrink: 0; }
#ac-activity-panel .ac-act-title { font-size: 12.5px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 7px; }
#ac-activity-panel .ac-act-count { font-size: 10.5px; background: #6366f1; color: #fff; padding: 1.5px 8px; border-radius: 9px; font-weight: 700; font-family: ui-monospace, monospace; }
#ac-activity-panel .ac-act-actions { display: flex; gap: 4px; }
#ac-activity-panel .ac-act-btn { width: 26px; height: 26px; border-radius: 7px; border: none; background: transparent; color: #64748b; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
#ac-activity-panel .ac-act-btn:hover { background: #f1f5f9; color: #0f172a; }
#ac-activity-panel .ac-act-feed { flex: 1; overflow-y: auto; padding: 8px 0; }
#ac-activity-panel .ac-act-feed::-webkit-scrollbar { width: 7px; }
#ac-activity-panel .ac-act-feed::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.ac-act-entry { padding: 9px 15px; border-left: 3px solid #64748b; margin: 2px 0; cursor: pointer; transition: background 0.12s; }
.ac-act-entry:hover { background: #f8fafc; }
.ac-act-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.ac-act-icon { font-size: 13px; flex-shrink: 0; }
.ac-act-time { font-size: 10.5px; color: #94a3b8; font-family: ui-monospace, monospace; }
.ac-act-type { font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; }
.ac-act-msg { font-size: 12px; color: #334155; line-height: 1.5; word-break: break-word; }
.ac-free-tier-badge { display:inline-flex; align-items:center; gap:4px; padding:2.5px 9px; border-radius:9px; font-size:10px; font-weight:700; letter-spacing:0.02em; }
.ac-free-tier-free { background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; }
.ac-free-tier-freemium { background:#fef3c7; color:#d97706; border:1px solid #fde68a; }
.ac-free-tier-paid { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
.ac-fm-model-row { display:flex; align-items:center; gap:6px; padding:7px 11px; border-radius:7px; background:#fff; margin:3px 0; font-size:11.5px; font-family: ui-monospace, monospace; transition: transform 0.12s ease, box-shadow 0.15s ease; }
.ac-fm-model-row:hover { transform: translateX(2px); box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
.ac-fm-model-row .ac-fm-id { flex:1; min-width:0; color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ac-tabs-wrapper + .ac-dialog-body { padding-top:22px; }
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // FREE MODELS DIALOG
    // ============================================================
    function tierBadge(tier) {
        if (tier === 'free') return '<span class="ac-free-tier-badge ac-free-tier-free">FREE</span>';
        if (tier === 'freemium') return '<span class="ac-free-tier-badge ac-free-tier-freemium">FREEMIUM</span>';
        return '<span class="ac-free-tier-badge ac-free-tier-paid">PAID</span>';
    }

    function useModelForProvider(providerId, modelId, currentOverlay) {
        const provider = PROVIDERS[providerId];
        if (!provider) return;
        const keys = (SETTINGS.keys || []).filter(k => k.enabled !== false && k.provider === providerId);
        if (keys.length === 0) {
            if (currentOverlay) currentOverlay.remove();
            showToast(`Chưa có key cho ${provider.label} — mở form thêm key`, 'info', 2500);
            showAddKeyDialog(null, { provider: providerId, model: modelId });
            return;
        }
        const active = keys.find(k => k.id === SETTINGS.activeKeyId) || keys[0];
        active.model = modelId;
        SETTINGS.activeKeyId = active.id;
        saveSettings(SETTINGS);
        showToast(`✅ Đã dùng: ${provider.emoji} ${modelId}`, 'success', 2500);
        try { logActivity('info', `Chuyển model → ${providerId}/${modelId}`); } catch (e) {}
    }

    function showFreeModelsDialog() {
        document.getElementById('ac-free-models-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-free-models-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '860px';

        async function render(forceRefresh = false) {
            box.innerHTML = `
                <div class="ac-dialog-header">
                    <div>
                        <h3 class="ac-dialog-title">🆓 Live Model List — All Providers</h3>
                        <p class="ac-dialog-subtitle">Fetch LIVE danh sách model đang hoạt động · 📋 copy ID · ▶️ dùng ngay</p>
                    </div>
                    <button class="ac-dialog-close" id="fm-close-x">×</button>
                </div>
                <div class="ac-dialog-body">
                    <div class="ac-loading"><span class="ac-spinner"></span><span>${forceRefresh ? 'Đang fetch từ providers...' : 'Đang tải...'}</span></div>
                </div>
                <div class="ac-dialog-footer">
                    <button class="ac-btn ac-btn-secondary" id="fm-refresh" style="margin-right:auto;">🔄 Làm mới (force)</button>
                    <button class="ac-btn ac-btn-primary" id="fm-close">Đóng</button>
                </div>
            `;
            const close = () => overlay.remove();
            document.getElementById('fm-close').onclick = close;
            document.getElementById('fm-close-x').onclick = close;
            document.getElementById('fm-refresh').onclick = () => render(true);
            const cache = forceRefresh
                ? await refreshFreeModelsCache(true)
                : (getFreeModelsCache() || await refreshFreeModelsCache(false));
            renderData(cache);
        }

        function modelRowHtml(m, providerId, style) {
            return `<div class="ac-fm-model-row" style="${style}" data-model-id="${escapeHtml(m.id)}" data-provider="${providerId}">
                <span class="ac-fm-id">${escapeHtml(m.id)}</span>
                ${m.vision ? '<span title="Vision">👁️</span>' : ''}
                ${tierBadge(m.tier)}
                <button type="button" class="ac-fm-copy" title="Copy model ID" style="border:none;background:rgba(0,0,0,0.06);border-radius:6px;cursor:pointer;font-size:12px;padding:3px 8px;margin-left:2px;transition:background 0.15s;">📋</button>
                <button type="button" class="ac-fm-use" title="Dùng model này" style="border:none;background:rgba(16,185,129,0.15);color:#059669;border-radius:6px;cursor:pointer;font-size:12px;padding:3px 8px;transition:background 0.15s;">▶️</button>
            </div>`;
        }

        function attachRowHandlers(container) {
            container.querySelectorAll('.ac-fm-copy').forEach(b => b.onclick = async (e) => {
                e.stopPropagation();
                const id = b.closest('.ac-fm-model-row').dataset.modelId;
                try {
                    await navigator.clipboard.writeText(id);
                    b.textContent = '✅';
                    showToast(`Đã copy: ${id}`, 'success', 1500);
                    setTimeout(() => { b.textContent = '📋'; }, 1500);
                } catch (err) { showToast('Không copy được', 'error', 2000); }
            });
            container.querySelectorAll('.ac-fm-use').forEach(b => b.onclick = (e) => {
                e.stopPropagation();
                const row = b.closest('.ac-fm-model-row');
                useModelForProvider(row.dataset.provider, row.dataset.modelId, overlay);
            });
        }

        function renderData(cache) {
            const body = box.querySelector('.ac-dialog-body');
            if (!cache || !cache.data || Object.keys(cache.data).length === 0) {
                body.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:13px;"><div style="font-size:36px;margin-bottom:10px;">🆓</div><div style="font-weight:600;color:#64748b;">Chưa có dữ liệu</div></div>`;
                return;
            }
            const age = Math.round((Date.now() - cache.timestamp) / 60000);
            const ageStr = age < 60 ? `${age} phút trước` : `${Math.round(age/60)} giờ trước`;
            const liveCount = Object.values(cache.data).filter(d => d.source === 'live').length;
            const staticCount = Object.values(cache.data).filter(d => d.source === 'static').length;

            let html = `<div style="display:flex;flex-wrap:wrap;gap:14px;font-size:12px;padding:11px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;margin-bottom:16px;">
                <span>📅 <b>Cache:</b> ${ageStr}</span>
                <span>🏢 <b>Providers:</b> ${Object.keys(cache.data).length}</span>
                <span>📡 <b>LIVE:</b> ${liveCount}</span>
                <span>📄 <b>Static:</b> ${staticCount}</span>
                ${isFreeModelsAutoRefreshOn() ? '<span style="color:#059669;">✅ Auto-refresh bật</span>' : ''}
            </div>`;

            for (const [providerId, providerData] of Object.entries(cache.data)) {
                const provider = PROVIDERS[providerId];
                if (!provider) continue;
                const models = providerData.models || [];
                const freeModels = models.filter(m => m.tier === 'free');
                const freemiumModels = models.filter(m => m.tier === 'freemium');
                const paidModels = models.filter(m => m.tier === 'paid');
                const visionBadge = provider.supportsVision ? '<span style="color:#c026d3;font-weight:700;font-size:11px;">👁️ vision</span>' : '<span style="color:#94a3b8;font-size:11px;">Không vision</span>';
                const sourceBadge = providerData.source === 'live'
                    ? '<span style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">LIVE</span>'
                    : '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">STATIC</span>';
                const hasKey = (SETTINGS.keys || []).some(k => k.enabled !== false && k.provider === providerId);

                html += `
                    <div class="ac-section" style="padding:15px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:13px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:11px;flex-wrap:wrap;">
                            <h4 class="ac-section-title" style="margin:0;font-size:14px;"><span style="font-size:18px;">${provider.emoji}</span>${provider.label}</h4>
                            ${sourceBadge}
                            ${visionBadge}
                            ${hasKey ? '<span style="background:#eef2ff;color:#6366f1;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">🔑 có key</span>' : '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">chưa có key</span>'}
                            <span style="margin-left:auto;font-size:11.5px;color:#64748b;">${models.length} models · <b style="color:#059669;">${freeModels.length} FREE</b></span>
                        </div>
                        <div class="ac-info" style="font-size:11.5px;margin-bottom:12px;">${provider.freeInfo || ''}</div>
                        ${freeModels.length > 0 ? `
                            <div style="margin-bottom:11px;">
                                <div style="font-weight:700;color:#059669;font-size:11.5px;margin-bottom:7px;text-transform:uppercase;letter-spacing:0.05em;">✅ Miễn phí đang hoạt động (${freeModels.length})</div>
                                ${freeModels.map(m => modelRowHtml(m, providerId, 'background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;')).join('')}
                            </div>
                        ` : ''}
                        ${freemiumModels.length > 0 ? `
                            <div style="margin-bottom:11px;">
                                <div style="font-weight:700;color:#d97706;font-size:11.5px;margin-bottom:7px;text-transform:uppercase;letter-spacing:0.05em;">⚖️ Freemium (${freemiumModels.length})</div>
                                ${freemiumModels.map(m => modelRowHtml(m, providerId, 'background:#fffbeb;border:1px solid #fde68a;color:#92400e;')).join('')}
                            </div>
                        ` : ''}
                        ${paidModels.length > 0 ? `
                            <details>
                                <summary style="cursor:pointer;font-weight:700;color:#dc2626;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:7px;padding:4px 0;">💵 Trả phí (${paidModels.length}) — bấm để xem</summary>
                                <div style="margin-top:6px;">
                                    ${paidModels.slice(0, 20).map(m => modelRowHtml(m, providerId, 'background:#fef2f2;border:1px solid #fecaca;color:#991b1b;')).join('')}
                                    ${paidModels.length > 20 ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;text-align:center;">... và ${paidModels.length - 20} model khác</div>` : ''}
                                </div>
                            </details>
                        ` : ''}
                        ${providerData.error ? `<div style="font-size:11px;color:#d97706;margin-top:9px;">ℹ️ ${escapeHtml(providerData.error)}</div>` : ''}
                    </div>
                `;
            }
            body.innerHTML = html;
            attachRowHandlers(body);
        }

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        render(false);
    }

    // ============================================================
    // CACHE MANAGER
    // ============================================================
    function showCacheManagerDialog() {
        document.getElementById('ac-cache-manager')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-cache-manager';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '780px';

        function render() {
            const cache = loadCache();
            const stats = cacheStats();
            const now = Date.now();
            const ttlMs = getCacheTTL() * 24 * 60 * 60 * 1000;
            const entries = Object.entries(cache.entries).map(([h, e]) => ({ h, ...e })).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
            const subjectBadges = Object.entries(stats.bySubject).map(([s, n]) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#f1f5f9;border-radius:6px;font-size:11px;color:#334155;">${SUBJECT_EMOJI[s] || '🎯'} ${s} <b>${n}</b></span>`).join(' ');
            const rowsHtml = entries.length === 0
                ? `<div style="padding:50px 20px;text-align:center;color:#94a3b8;font-size:13px;"><div style="font-size:36px;margin-bottom:10px;">📭</div><div style="font-weight:600;color:#64748b;">Cache trống</div></div>`
                : entries.map(e => {
                    const isExp = now - e.timestamp > ttlMs;
                    const age = Math.round((now - e.timestamp) / 60000);
                    const ageStr = age < 60 ? `${age}m` : age < 1440 ? `${Math.round(age/60)}h` : `${Math.round(age/1440)}d`;
                    return `<div class="ac-cache-row" ${isExp ? 'style="opacity:0.55;border-color:#fecaca;"' : ''}><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:${isExp ? '#dc2626' : '#6366f1'};color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;font-family:ui-monospace,monospace;">${e.h}</span><span style="font-size:11px;color:#64748b;">${SUBJECT_EMOJI[e.subject] || '🎯'} ${e.subject || 'generic'}</span>${e.confidence !== null && e.confidence !== undefined ? `<span style="font-size:11px;font-weight:600;color:${e.confidence >= 7 ? '#059669' : e.confidence >= 5 ? '#f59e0b' : '#dc2626'};">conf ${e.confidence}/10</span>` : ''}${isExp ? '<span style="font-size:10px;color:#dc2626;font-weight:700;">EXPIRED</span>' : ''}<span style="margin-left:auto;font-size:11px;color:#94a3b8;">${ageStr} · ${e.hits || 0} hits</span></div><div class="ac-cache-q">${escapeHtml((e.question || '').substring(0, 220))}</div><div class="ac-cache-a">${escapeHtml((e.answer || '').substring(0, 200))}</div><div style="margin-top:9px;display:flex;gap:6px;"><button type="button" class="ac-btn ac-btn-secondary ac-cache-delete" data-hash="${e.h}" style="height:28px;padding:0 11px;font-size:11.5px;color:#dc2626;border-color:#fecaca;">🗑️ Xóa</button><button type="button" class="ac-btn ac-btn-secondary ac-cache-copy" data-hash="${e.h}" style="height:28px;padding:0 11px;font-size:11.5px;">📄 Copy</button></div></div>`;
                }).join('');

            box.innerHTML = `
                <div class="ac-dialog-header"><div><h3 class="ac-dialog-title">💾 Quản lý Cache</h3><p class="ac-dialog-subtitle">${stats.valid} hợp lệ · ${stats.expired} hết hạn · ${stats.totalHits} lần hit</p></div><button class="ac-dialog-close" id="cm-close">×</button></div>
                <div class="ac-dialog-body">
                    <div class="ac-section">
                        <div class="ac-info" style="flex-direction:column;align-items:stretch;gap:10px;">
                            <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:12px;"><span>Tổng: <b>${stats.total}</b></span><span>Hợp lệ: <b style="color:#059669;">${stats.valid}</b></span><span>Hết hạn: <b style="color:#dc2626;">${stats.expired}</b></span><span>TTL: <b>${getCacheTTL()}</b> ngày</span></div>
                            ${subjectBadges ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${subjectBadges}</div>` : ''}
                        </div>
                        <div style="display:flex;gap:8px;margin-top:13px;flex-wrap:wrap;">
                            <button type="button" class="ac-btn ac-btn-secondary" id="cm-prune" style="height:34px;font-size:12px;">🧹 Xóa hết hạn</button>
                            <button type="button" class="ac-btn ac-btn-secondary" id="cm-copy-all" style="height:34px;font-size:12px;">📋 Copy toàn bộ</button>
                            <button type="button" class="ac-btn ac-btn-danger" id="cm-clear" style="height:34px;font-size:12px;margin-left:auto;">🗑️ Xóa hết</button>
                        </div>
                    </div>
                    <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📦</span>Entries (${entries.length})</h4><div>${rowsHtml}</div></div>
                </div>
                <div class="ac-dialog-footer"><button class="ac-btn ac-btn-primary" id="cm-close-2">Đóng</button></div>
            `;
            const close = () => overlay.remove();
            document.getElementById('cm-close').onclick = close;
            document.getElementById('cm-close-2').onclick = close;
            document.getElementById('cm-prune').onclick = () => { const r = cachePrune(); showToast(r > 0 ? `Đã xóa ${r} entries` : 'Không có entries hết hạn', r > 0 ? 'success' : 'info', 2000); render(); };
            document.getElementById('cm-clear').onclick = () => { if (!confirm(`Xóa toàn bộ ${stats.total} entries?`)) return; cacheClear(); showToast('Đã xóa toàn bộ cache', 'success', 2000); render(); };
            document.getElementById('cm-copy-all').onclick = async () => {
                if (entries.length === 0) { showToast('Cache trống', 'info', 2000); return; }
                const text = entries.map(e => `[${e.h}] ${SUBJECT_EMOJI[e.subject] || '🎯'} ${e.subject}\nQ: ${e.question}\nA: ${e.answer}`).join('\n\n---\n\n');
                try { await navigator.clipboard.writeText(text); showToast(`Đã copy ${entries.length} entries`, 'success', 2000); } catch (e) {}
            };
            box.querySelectorAll('.ac-cache-delete').forEach(b => b.addEventListener('click', () => { const h = b.dataset.hash; const c = loadCache(); if (c.entries[h]) { delete c.entries[h]; saveCache(); showToast('Đã xóa entry', 'success', 1500); render(); } }));
            box.querySelectorAll('.ac-cache-copy').forEach(b => b.addEventListener('click', async () => {
                const h = b.dataset.hash; const c = loadCache(); const entry = c.entries[h]; if (!entry) return;
                try { await navigator.clipboard.writeText(entry.answer); b.textContent = '✅'; setTimeout(() => { b.textContent = '📄 Copy'; }, 1500); } catch (e) {}
            }));
        }
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        render();
    }

    // ============================================================
    // HEALTH DIALOG
    // ============================================================
    function showHealthDialog() {
        document.getElementById('ac-health-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-health-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '620px';

        function render() {
            const r = runHealthCheck();
            const age = lastHealthReport ? Math.round((Date.now() - lastHealthReport.timestamp) / 1000) : 0;
            const ageStr = age < 60 ? `${age}s trước` : `${Math.round(age/60)}m trước`;

            const rows = r.checks.map(c => {
                const icon = c.ok ? '✅' : (c.critical ? '❌' : '⚠️');
                const color = c.ok ? '#059669' : (c.critical ? '#dc2626' : '#f59e0b');
                const bg = c.ok ? '#fff' : (c.critical ? '#fef2f2' : '#fffbeb');
                const border = c.ok ? '#e2e8f0' : (c.critical ? '#fecaca' : '#fde68a');
                return `<div style="padding:10px 13px;border:1.5px solid ${border};border-radius:9px;background:${bg};margin-bottom:7px;display:flex;align-items:flex-start;gap:10px;">
                    <span style="font-size:15px;flex-shrink:0;line-height:1.3;">${icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12.5px;font-weight:600;color:#0f172a;margin-bottom:2px;">${c.name}</div>
                        <div style="font-size:11px;color:#64748b;font-family:ui-monospace,monospace;word-break:break-word;">${escapeHtml(c.detail)}</div>
                        ${!c.ok && c.hint ? `<div style="font-size:11px;color:${color};margin-top:5px;font-style:italic;line-height:1.4;">💡 ${escapeHtml(c.hint)}</div>` : ''}
                    </div>
                    <span style="font-size:9.5px;font-weight:700;color:${color};flex-shrink:0;padding:2px 6px;border-radius:5px;background:${c.ok ? 'transparent' : (c.critical ? '#fee2e2' : '#fef3c7')};">${c.critical ? 'CRIT' : 'INFO'}</span>
                </div>`;
            }).join('');

            box.innerHTML = `
                <div class="ac-dialog-header">
                    <div>
                        <h3 class="ac-dialog-title">🩺 Trạng thái Script ↔ Edunext</h3>
                        <p class="ac-dialog-subtitle">v${CURRENT_VERSION} · ${r.running ? 'Auto Chat đang BẬT' : 'Auto Chat đang TẮT'} · cập nhật ${ageStr}</p>
                    </div>
                    <button class="ac-dialog-close" id="hd-close-x">×</button>
                </div>
                <div class="ac-dialog-body">
                    <div style="padding:16px 18px;border:1.5px solid ${r.critOk ? '#a7f3d0' : '#fecaca'};border-radius:13px;background:${r.critOk ? 'linear-gradient(135deg, #ecfdf5, #f0fdf4)' : 'linear-gradient(135deg, #fef2f2, #fff1f2)'};margin-bottom:16px;">
                        <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
                            <div style="font-size:40px;font-weight:700;color:${scoreColor(r.score)};font-family:ui-monospace,monospace;line-height:1;letter-spacing:-0.02em;">${r.score}%</div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:3px;">${scoreLabel(r.score)}</div>
                                <div style="font-size:11.5px;color:#64748b;">${r.okCount}/${r.total} kiểm tra đạt</div>
                            </div>
                        </div>
                        <div style="height:8px;background:rgba(0,0,0,0.06);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${r.score}%;background:${scoreColor(r.score)};transition:width 0.4s ease;"></div>
                        </div>
                    </div>

                    <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.06em;margin-bottom:8px;padding-left:2px;">Chi tiết kiểm tra</div>
                    ${rows}

                    <div style="margin-top:14px;padding:11px 13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:11.5px;color:#64748b;line-height:1.55;">
                        <div style="font-weight:700;color:#334155;margin-bottom:4px;">💡 Cách đọc kết quả</div>
                        <div>• <b>CRIT ❌</b> — script không thể chạy. Cần báo lỗi ngay.</div>
                        <div>• <b>INFO ⚠️</b> — script vẫn chạy nhưng có phần không khớp.</div>
                    </div>
                </div>
                <div class="ac-dialog-footer">
                    <button class="ac-btn ac-btn-secondary" id="hd-open-settings" style="margin-right:auto;">⚙️ Cài đặt Selectors</button>
                    <button class="ac-btn ac-btn-secondary" id="hd-copy">📄 Copy báo cáo</button>
                    <button class="ac-btn ac-btn-secondary" id="hd-rerun">🔄 Chạy lại</button>
                    <button class="ac-btn ac-btn-primary" id="hd-close">Đóng</button>
                </div>
            `;
            const close = () => overlay.remove();
            document.getElementById('hd-close').onclick = close;
            document.getElementById('hd-close-x').onclick = close;
            document.getElementById('hd-rerun').onclick = render;
            document.getElementById('hd-open-settings').onclick = () => { close(); activeSettingsTab = 'selectors'; showSettingsDialog(); };
            document.getElementById('hd-copy').onclick = async () => {
                const text = `Auto Chat v${CURRENT_VERSION} — Health Report\n` +
                    `URL: ${r.url}\nTime: ${new Date(r.timestamp).toLocaleString('vi-VN')}\n` +
                    `Score: ${r.score}% (${r.okCount}/${r.total})\n` +
                    `Auto Chat: ${r.running ? 'ON' : 'OFF'}\n\n` +
                    r.checks.map(c => `${c.ok ? '✅' : (c.critical ? '❌' : '⚠️')} ${c.name} — ${c.detail}`).join('\n');
                try { await navigator.clipboard.writeText(text); showToast('Đã copy', 'success', 1500); } catch (e) { showToast('Không copy được', 'error', 2000); }
            };
        }
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        render();
    }

    // ============================================================
    // KEY MANAGER
    // ============================================================
    function showKeyManagerDialog() {
        document.getElementById('ac-key-manager')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-key-manager';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '640px';

        function render() {
            const keys = SETTINGS.keys || [];
            const activeId = SETTINGS.activeKeyId;
            const rowsHtml = keys.length === 0
                ? `<div style="padding:50px 20px;text-align:center;color:#94a3b8;font-size:13px;"><div style="font-size:36px;margin-bottom:10px;">🔑</div><div style="font-weight:600;color:#64748b;">Chưa có API key nào</div></div>`
                : keys.map(k => {
                    const p = PROVIDERS[k.provider];
                    const isActive = k.id === activeId;
                    const masked = k.key ? (k.key.substring(0, 8) + '•••' + k.key.slice(-4)) : '(không có)';
                    const visionBadge = p?.supportsVision ? ' 👁️' : '';
                    const modelWarn = (!k.model || !String(k.model).trim())
                        ? ' <span style="color:#dc2626;font-weight:700;font-size:10.5px;">⚠️ CHƯA CÓ MODEL</span>'
                        : '';
                    return `<div class="ac-key-row ${isActive ? 'ac-key-row-active' : ''}"><div style="font-size:22px;flex-shrink:0;">${p?.emoji || '🔑'}</div><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;"><span style="font-size:13px;font-weight:700;color:#0f172a;">${k.name || p?.label || 'Key'}${visionBadge}</span>${isActive ? '<span style="background:#6366f1;color:#fff;padding:1px 7px;border-radius:6px;font-size:9.5px;font-weight:700;">ACTIVE</span>' : ''}${modelWarn}</div><div style="font-size:11px;color:#64748b;">${p?.label || '?'} · <span style="font-family:ui-monospace,monospace;">${k.model || '?'}</span></div><div style="font-size:10.5px;color:#94a3b8;font-family:ui-monospace,monospace;margin-top:3px;">${masked}</div></div><div style="display:flex;gap:4px;flex-shrink:0;">${!isActive ? `<button type="button" class="ac-btn ac-btn-secondary ac-key-activate" data-key-id="${k.id}" style="height:30px;padding:0 11px;font-size:11.5px;">Dùng</button>` : ''}<button type="button" class="ac-btn ac-btn-secondary ac-key-edit" data-key-id="${k.id}" style="height:30px;padding:0 11px;font-size:11.5px;">Sửa</button><button type="button" class="ac-btn ac-btn-secondary ac-key-delete" data-key-id="${k.id}" style="height:30px;padding:0 11px;font-size:11.5px;color:#dc2626;border-color:#fecaca;">Xóa</button></div></div>`;
                }).join('');

            box.innerHTML = `
                <div class="ac-dialog-header"><div><h3 class="ac-dialog-title">🔑 Quản lý API Keys</h3><p class="ac-dialog-subtitle">${keys.length} key · 👁️ = hỗ trợ đọc ảnh</p></div><button class="ac-dialog-close" id="km-close">×</button></div>
                <div class="ac-dialog-body"><div style="display:flex;flex-direction:column;gap:8px;">${rowsHtml}</div></div>
                <div class="ac-dialog-footer"><button class="ac-btn ac-btn-primary" id="km-add" style="margin-right:auto;">+ Thêm key mới</button><button class="ac-btn ac-btn-secondary" id="km-free" style="background:#ecfdf5;color:#059669;border-color:#a7f3d0;">🆓 Live Model List</button><button class="ac-btn ac-btn-secondary" id="km-close-2">Đóng</button></div>
            `;
            const close = () => overlay.remove();
            document.getElementById('km-close').onclick = close;
            document.getElementById('km-close-2').onclick = close;
            document.getElementById('km-add').onclick = () => { overlay.remove(); showAddKeyDialog(null); };
            document.getElementById('km-free').onclick = () => { overlay.remove(); showFreeModelsDialog(); };
            box.querySelectorAll('.ac-key-activate').forEach(b => b.addEventListener('click', () => { SETTINGS.activeKeyId = b.dataset.keyId; saveSettings(SETTINGS); const k = SETTINGS.keys.find(x => x.id === b.dataset.keyId); showToast(`Đã chuyển: ${k?.name || b.dataset.keyId}`, 'success', 2000); render(); }));
            box.querySelectorAll('.ac-key-edit').forEach(b => b.addEventListener('click', () => { overlay.remove(); showAddKeyDialog(b.dataset.keyId); }));
            box.querySelectorAll('.ac-key-delete').forEach(b => b.addEventListener('click', () => {
                const id = b.dataset.keyId; const k = SETTINGS.keys.find(x => x.id === id); if (!k) return;
                if (!confirm(`Xóa key "${k.name || id}"?`)) return;
                SETTINGS.keys = SETTINGS.keys.filter(x => x.id !== id);
                if (SETTINGS.activeKeyId === id) SETTINGS.activeKeyId = SETTINGS.keys[0]?.id || '';
                saveSettings(SETTINGS); showToast('Đã xóa key', 'info', 2000); render();
            }));
        }
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        render();
    }

    // ============================================================
    // ADD/EDIT KEY DIALOG
    // ============================================================
    function showAddKeyDialog(existingId = null, prefill = null) {
        document.getElementById('ac-add-key')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-add-key';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '600px';
        const existing = existingId ? (SETTINGS.keys || []).find(k => k.id === existingId) : null;
        const initialProvider = existing?.provider || prefill?.provider || 'groq';
        const providerOptions = Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === initialProvider ? 'selected' : ''}>${p.emoji} ${p.label}</option>`).join('');

        box.innerHTML = `
            <div class="ac-dialog-header"><div><h3 class="ac-dialog-title">${existing ? '✏️ Sửa API Key' : '➕ Thêm API Key mới'}</h3></div><button class="ac-dialog-close" id="ak-close">×</button></div>
            <div class="ac-dialog-body">
                <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🏢</span>Nhà cung cấp</h4><select id="ak-provider" class="ac-input">${providerOptions}</select><div id="ak-free-info" class="ac-info" style="margin-top:10px;"></div></div>
                <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🎯</span>Model</h4><p class="ac-section-desc" id="ak-model-hint"></p><input id="ak-model" class="ac-input" type="text" list="ak-model-suggestions" autocomplete="off" spellcheck="false" placeholder="Chọn gợi ý hoặc gõ model"><datalist id="ak-model-suggestions"></datalist><div id="ak-model-tiers" style="margin-top:12px;"></div></div>
                <div class="ac-section" id="ak-endpoint-section" style="display:none;"><h4 class="ac-section-title"><span class="ac-section-emoji">🌐</span>Endpoint</h4><input id="ak-endpoint" class="ac-input" type="text" placeholder="http://localhost:11434/v1/chat/completions" value="${existing?.customEndpoint || ''}" spellcheck="false"></div>
                <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📛</span>Tên gợi nhớ</h4><input id="ak-name" class="ac-input" type="text" placeholder="Ví dụ: Groq cá nhân" value="${existing?.name || ''}" spellcheck="false"></div>
                <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🔑</span>API Key</h4><div id="ak-key-help" class="ac-info" style="margin-bottom:10px;"></div><input id="ak-key" class="ac-input" type="text" value="${existing?.key || ''}" autocomplete="off" spellcheck="false"></div>
                <div id="ak-status" class="ac-status"></div>
            </div>
            <div class="ac-dialog-footer"><button class="ac-btn ac-btn-secondary" id="ak-test" style="margin-right:auto;">🔍 Test</button><button class="ac-btn ac-btn-secondary" id="ak-cancel">Hủy</button><button class="ac-btn ac-btn-primary" id="ak-save">${existing ? 'Lưu' : 'Thêm key'}</button></div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const providerSel = document.getElementById('ak-provider');
        const modelInput = document.getElementById('ak-model');
        const modelHint = document.getElementById('ak-model-hint');
        const datalist = document.getElementById('ak-model-suggestions');
        const endpointSection = document.getElementById('ak-endpoint-section');
        const endpointInput = document.getElementById('ak-endpoint');
        const nameInput = document.getElementById('ak-name');
        const keyInput = document.getElementById('ak-key');
        const keyHelp = document.getElementById('ak-key-help');
        const status = document.getElementById('ak-status');
        const freeInfo = document.getElementById('ak-free-info');
        const modelTiers = document.getElementById('ak-model-tiers');

        if (existing?.model && String(existing.model).trim()) {
            modelInput.value = existing.model;
        } else if (prefill?.model) {
            modelInput.value = prefill.model;
        } else {
            const p0 = PROVIDERS[initialProvider];
            if (p0?.models?.[0]?.id) modelInput.value = p0.models[0].id;
        }

        function refresh() {
            const p = PROVIDERS[providerSel.value];
            datalist.innerHTML = (p.models || []).map(m => `<option value="${m.id}">${m.label}</option>`).join('');
            if (!modelInput.value || !modelInput.value.trim()) {
                modelInput.value = p.models?.[0]?.id || 'openai/gpt-oss-20b';
            }
            modelHint.innerHTML = p.models?.length > 0 ? `Gợi ý <b>${p.models.length}</b> model.` : 'Nhập model.';
            endpointSection.style.display = providerSel.value === 'custom' ? '' : 'none';
            freeInfo.innerHTML = `<span>💡</span><span>${p.freeInfo || ''}</span>`;
            const fmCache = getFreeModelsCache();
            const liveData = fmCache?.data?.[providerSel.value];
            if (liveData && liveData.models && liveData.models.length > 0) {
                const free = liveData.models.filter(m => m.tier === 'free');
                const freemium = liveData.models.filter(m => m.tier === 'freemium');
                const paid = liveData.models.filter(m => m.tier === 'paid');
                const vision = p.supportsVision ? '<span style="color:#c026d3;font-weight:700;">👁️ Có vision</span>' : '<span style="color:#94a3b8;">Không vision</span>';
                modelTiers.innerHTML = `
                    <div style="padding:11px 13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;font-size:11.5px;color:#334155;">
                            <b>📡 LIVE:</b>
                            <span style="color:#059669;">${free.length} FREE</span>
                            ${freemium.length > 0 ? `<span style="color:#d97706;">${freemium.length} FREEMIUM</span>` : ''}
                            <span style="color:#dc2626;">${paid.length} PAID</span>
                            <span style="margin-left:auto;">${vision}</span>
                        </div>
                        ${free.length > 0 ? `<div style="margin-bottom:6px;"><div style="font-size:10.5px;color:#059669;font-weight:700;text-transform:uppercase;margin-bottom:4px;letter-spacing:0.05em;">✅ FREE</div>${free.slice(0, 8).map(m => `<div style="padding:3px 0;font-size:11.5px;font-family:ui-monospace,monospace;color:#065f46;">${escapeHtml(m.id)}${m.vision ? ' 👁️' : ''}</div>`).join('')}${free.length > 8 ? `<div style="font-size:11px;color:#94a3b8;">...và ${free.length - 8} model khác</div>` : ''}</div>` : ''}
                        <div style="text-align:center;margin-top:9px;"><button type="button" class="ac-btn ac-btn-secondary" id="ak-view-free" style="height:28px;font-size:11px;padding:0 12px;">🆓 Xem toàn bộ Live Model List</button></div>
                    </div>
                `;
                setTimeout(() => { const b = document.getElementById('ak-view-free'); if (b) b.onclick = () => { overlay.remove(); showFreeModelsDialog(); }; }, 0);
            } else {
                const freeCount = (p.models || []).filter(m => m.tier === 'free').length;
                const freemiumCount = (p.models || []).filter(m => m.tier === 'freemium').length;
                const paidCount = (p.models || []).filter(m => m.tier === 'paid').length;
                const vision = p.supportsVision ? '<span style="color:#c026d3;font-weight:700;">👁️ Có vision</span>' : '<span style="color:#94a3b8;">Không vision</span>';
                modelTiers.innerHTML = `
                    <div style="padding:11px 13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11.5px;color:#334155;">
                            <b>📊 Static:</b>
                            <span style="color:#059669;">${freeCount} FREE</span>
                            ${freemiumCount > 0 ? `<span style="color:#d97706;">${freemiumCount} FREEMIUM</span>` : ''}
                            <span style="color:#dc2626;">${paidCount} PAID</span>
                            <span style="margin-left:auto;">${vision}</span>
                        </div>
                        <div style="font-size:11px;color:#94a3b8;text-align:center;">Bấm "🆓 Live Model List" để xem danh sách LIVE</div>
                    </div>
                `;
            }
            if (providerSel.value === 'custom') { keyHelp.innerHTML = `<span>🔧</span><span>Custom endpoint — dán bất kỳ giá trị, để trống với Ollama.</span>`; keyInput.placeholder = 'bất kỳ giá trị nào'; }
            else { const link = p.keyHelp && p.keyHelp.startsWith('http') ? `<a href="${p.keyHelp}" target="_blank" style="color:#6366f1;">${p.keyHelp}</a>` : p.keyHelp || ''; keyHelp.innerHTML = `<span>${p.emoji}</span><span><b>${p.label}:</b> key bắt đầu bằng <code>${p.keyHint}</code>. Lấy tại ${link}</span>`; keyInput.placeholder = p.keyHint || 'Dán key...'; }
        }
        refresh();
        providerSel.addEventListener('change', () => { const np = PROVIDERS[providerSel.value]; if (!np.models?.some(m => m.id === modelInput.value)) modelInput.value = np.models?.[0]?.id || ''; refresh(); });
        modelInput.addEventListener('input', refresh);

        const close = () => overlay.remove();
        document.getElementById('ak-close').onclick = close;
        document.getElementById('ak-cancel').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        document.getElementById('ak-test').onclick = () => {
            const key = keyInput.value.trim(); const model = modelInput.value.trim(); const pk = providerSel.value;
            if (!key && pk !== 'custom') { status.style.color = '#dc2626'; status.textContent = '❌ Chưa nhập key.'; return; }
            if (!model) { status.style.color = '#dc2626'; status.textContent = '❌ Chưa nhập model.'; return; }
            const testKey = { id:'test', provider: pk, model, name: nameInput.value || 'test', key: key || 'none', customEndpoint: pk === 'custom' ? endpointInput.value.trim() : '', enabled: true };
            status.style.color = '#6366f1'; status.textContent = '⏳ Đang test...';
            callProviderWithKey(testKey, { system:'You are a test assistant.', user:'Reply with one word: OK', temperature:0.1, maxTokens:20, timeout:20000 }).then(text => { status.style.color = '#059669'; status.textContent = `✅ OK — "${text.substring(0, 60)}"`; }).catch(err => { status.style.color = '#dc2626'; status.textContent = '❌ ' + err.message; });
        };

        document.getElementById('ak-save').onclick = () => {
            const key = keyInput.value.trim(); const model = modelInput.value.trim();
            const name = nameInput.value.trim() || PROVIDERS[providerSel.value].label;
            const pk = providerSel.value; const customEndpoint = pk === 'custom' ? endpointInput.value.trim() : '';
            if (!model) { status.style.color = '#dc2626'; status.textContent = '❌ Chưa nhập model.'; return; }
            if (pk !== 'custom' && !key) { status.style.color = '#dc2626'; status.textContent = '❌ Chưa nhập key.'; return; }
            if (pk === 'custom' && !customEndpoint) { status.style.color = '#dc2626'; status.textContent = '❌ Custom cần endpoint.'; return; }
            if (existing) { existing.provider = pk; existing.model = model; existing.name = name; existing.key = key; if (customEndpoint) existing.customEndpoint = customEndpoint; else delete existing.customEndpoint; }
            else { const nk = { id: uid(), provider: pk, model, name, key, enabled: true }; if (customEndpoint) nk.customEndpoint = customEndpoint; SETTINGS.keys.push(nk); if (!SETTINGS.activeKeyId) SETTINGS.activeKeyId = nk.id; }
            saveSettings(SETTINGS);
            showToast(existing ? 'Đã cập nhật key' : 'Đã thêm key', 'success', 2000);
            refreshFreeModelsCache(true);
            close();
            showKeyManagerDialog();
        };
    }

    // ============================================================
    // PROVIDER DISPATCH
    // ============================================================
    function callProviderWithKey(keyEntry, { system, user, temperature, maxTokens, timeout = 60000, track = true, images = null }) {
        return new Promise((resolve, reject) => {
            if (!keyEntry) { reject(new Error('Chưa có key')); return; }
            if (!keyEntry.model || !String(keyEntry.model).trim()) {
                reject(new Error('Model rỗng — vào 🔑 để chọn model cho key này'));
                return;
            }
            const provider = PROVIDERS[keyEntry.provider];
            if (!provider) { reject(new Error('Provider không hợp lệ: ' + keyEntry.provider)); return; }
            const hasImages = images && images.length > 0 && providerSupportsVision(keyEntry);
            let url, headers = {}, body;

                        if (provider.format === 'fpt_proxy') {
                url = keyEntry.customEndpoint || provider.endpoint;
                headers['Content-Type'] = 'application/json';
                const bodyPayload = {
                    licenseKey: keyEntry.key || 'TRIAL-EDUNEXT-2H-AUTO',
                    question: user,
                    images: hasImages ? images : null,
                    formatHint: 'template_match'
                };
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: headers,
                    data: JSON.stringify(bodyPayload),
                    timeout: timeout,
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (!data.success) {
                                reject(new Error(data.message || 'Lỗi từ Cloud AI Proxy'));
                                return;
                            }
                            resolve(data.answer);
                        } catch (e) {
                            reject(new Error('Parse lỗi Cloud AI: ' + e.message));
                        }
                    },
                    onerror: () => reject(new Error('Không thể kết nối tới Cloud AI Proxy (Kiểm tra server hoặc mạng)')),
                    ontimeout: () => reject(new Error('Timeout Cloud AI Proxy'))
                });
                return;
            }

            if (provider.format === 'openai') {
                url = keyEntry.customEndpoint || provider.endpoint;
                if (!url) { reject(new Error('Endpoint rỗng')); return; }
                headers['Content-Type'] = 'application/json';
                if (keyEntry.key && keyEntry.key !== 'none') headers['Authorization'] = 'Bearer ' + keyEntry.key;
                if (keyEntry.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://fsc-edunext.fpt.edu.vn/'; headers['X-Title'] = 'FPT EduNext Auto Chat'; }
                let userContent = user;
                if (hasImages) userContent = [{ type: 'text', text: user }, ...images.map(img => ({ type: 'image_url', image_url: { url: img } }))];
                body = JSON.stringify({ model: keyEntry.model, messages: [{ role:'system', content:system }, { role:'user', content:userContent }], temperature, max_tokens: maxTokens });
            } else if (provider.format === 'anthropic') {
                url = provider.endpoint;
                headers['Content-Type'] = 'application/json';
                headers['x-api-key'] = keyEntry.key;
                headers['anthropic-version'] = '2023-06-01';
                headers['anthropic-dangerous-direct-browser-access'] = 'true';
                let userContent = user;
                if (hasImages) userContent = [
                    ...images.map(img => {
                        const b64 = img.replace(/^data:image\/\w+;base64,/, '');
                        const mt = (img.match(/^data:(image\/\w+);/) || [])[1] || 'image/jpeg';
                        return { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } };
                    }),
                    { type: 'text', text: user }
                ];
                body = JSON.stringify({ model: keyEntry.model, max_tokens: maxTokens, system, messages: [{ role:'user', content:userContent }], temperature });
            } else if (provider.format === 'gemini') {
                url = provider.endpoint.replace('{model}', keyEntry.model);
                headers['Content-Type'] = 'application/json';
                headers['x-goog-api-key'] = keyEntry.key;
                let parts = [{ text: user }];
                if (hasImages) parts = [
                    ...images.map(img => {
                        const b64 = img.replace(/^data:image\/\w+;base64,/, '');
                        const mt = (img.match(/^data:(image\/\w+);/) || [])[1] || 'image/jpeg';
                        return { inlineData: { mimeType: mt, data: b64 } };
                    }),
                    { text: user }
                ];
                const isGemini3 = /^gemini-3\./i.test(keyEntry.model);
                const generationConfig = { temperature, maxOutputTokens: isGemini3 ? Math.max(maxTokens, 1024) : maxTokens };
                if (isGemini3) generationConfig.thinkingConfig = { thinkingLevel: /flash-lite/i.test(keyEntry.model) ? 'minimal' : 'low' };
                body = JSON.stringify({ systemInstruction: { parts:[{ text:system }] }, contents:[{ role:'user', parts }], generationConfig });
            } else { reject(new Error('Format không hỗ trợ: ' + provider.format)); return; }

            GM_xmlhttpRequest({
                method:'POST', url, headers, data:body, timeout,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) { reject(new Error(typeof data.error === 'string' ? data.error : (data.error.message || 'Lỗi API'))); return; }
                        let content = '', tokensIn = 0, tokensOut = 0;
                                    if (provider.format === 'fpt_proxy') {
                url = keyEntry.customEndpoint || provider.endpoint;
                headers['Content-Type'] = 'application/json';
                const bodyPayload = {
                    licenseKey: keyEntry.key || 'TRIAL-EDUNEXT-2H-AUTO',
                    question: user,
                    images: hasImages ? images : null,
                    formatHint: 'template_match'
                };
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: headers,
                    data: JSON.stringify(bodyPayload),
                    timeout: timeout,
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (!data.success) {
                                reject(new Error(data.message || 'Lỗi từ Cloud AI Proxy'));
                                return;
                            }
                            resolve(data.answer);
                        } catch (e) {
                            reject(new Error('Parse lỗi Cloud AI: ' + e.message));
                        }
                    },
                    onerror: () => reject(new Error('Không thể kết nối tới Cloud AI Proxy (Kiểm tra server hoặc mạng)')),
                    ontimeout: () => reject(new Error('Timeout Cloud AI Proxy'))
                });
                return;
            }

            if (provider.format === 'openai') { content = data.choices?.[0]?.message?.content?.trim(); const u = data.usage || {}; tokensIn = u.prompt_tokens || 0; tokensOut = u.completion_tokens || 0; }
                        else if (provider.format === 'anthropic') { const tb = (data.content || []).find(c => c.type === 'text'); content = tb?.text?.trim(); const u = data.usage || {}; tokensIn = u.input_tokens || 0; tokensOut = u.output_tokens || 0; }
                        else if (provider.format === 'gemini') {
                            const candidate = data.candidates?.[0];
                            const partsOut = candidate?.content?.parts || [];
                            content = partsOut.map(part => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n').trim();
                            const u = data.usageMetadata || {}; tokensIn = u.promptTokenCount || 0; tokensOut = u.candidatesTokenCount || 0;
                            if (!content) {
                                const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'không có text trong candidates';
                                reject(new Error(`Gemini không trả văn bản (HTTP ${res.status || '?'}; ${reason})`)); return;
                            }
                        }
                        if (!content) { reject(new Error(`API không trả văn bản (HTTP ${res.status || '?'})`)); return; }
                        if (track && keyEntry.id !== 'test') recordUsage(keyEntry.model, tokensIn, tokensOut);
                        resolve(content);
                    } catch (e) { reject(new Error('Parse lỗi: ' + e.message)); }
                },
                onerror: () => reject(new Error('Lỗi kết nối')),
                ontimeout: () => reject(new Error('Timeout'))
            });
        });
    }
    function callProvider(opts) { return callProviderWithKey(getActiveKey(), opts); }

    // ============================================================
    // AI CALLS
    // ============================================================
    const SYSTEM_PROMPT_VIETNAMESE_BLOCK = '[QUY TẮC NGÔN NGỮ — QUAN TRỌNG NHẤT, VI PHẠM LÀ SAI]\nToàn bộ câu trả lời PHẢI viết bằng TIẾNG VIỆT. Áp dụng cho MỌI phần: giải thích, lập luận, kết quả.\nNGOẠI LỆ: đề bài 100% tiếng Anh VÀ có câu lệnh "answer in English".\n\n[BẢO VỆ CÔNG THỨC KHOA HỌC — BẮT BUỘC]\nCác ký hiệu sau LUÔN GIỮ NGUYÊN:\n• Công thức hoá học: NH3, H2O, CO2, H2SO4, HCl, NaOH, NaCl, BaSO4, NH4+, OH-, H+, Cl-\n• Ký hiệu: pH, pOH, mol, M, x², √, π, Δ, ω, λ, θ, μ\n• Đơn vị SI: m, s, kg, N, J, W, V, A, Hz, Pa, mol, K\n• Chữ cái trắc nghiệm: A, B, C, D\nKHÔNG đổi: H2O → "nước", NH3 → "amoniac".\n\n[VÍ DỤ SAI → ĐÚNG]\n❌ "NH3 is the base" → ✅ "NH3 là bazơ"\n❌ "Nước đóng vai trò là axit" → ✅ "H2O đóng vai trò là axit"\n\n';

    const SYSTEM_PROMPT_ENGLISH_BLOCK = '[MÔN TIẾNG ANH — CHÍNH SÁCH NGÔN NGỮ]\n' +
        '• Giải thích ngữ pháp / từ vựng / đọc hiểu: viết bằng TIẾNG VIỆT.\n' +
        '• Dịch thuật, viết lại câu, viết đoạn văn tiếng Anh, hoặc đề yêu cầu trả lời bằng tiếng Anh: OUTPUT PHẢI LÀ TIẾNG ANH.\n' +
        '• Có thể chèn thuật ngữ tiếng Anh trong câu giải thích tiếng Việt.\n' +
        '• KHÔNG dịch công thức / từ chuyên môn đã chuẩn.\n\n';

    const SYSTEM_PROMPT_ENGLISH_AUTO_BLOCK = '[ENGLISH QUESTION DETECTED — AUTO ENGLISH ANSWER MODE]\n' +
        '• Đề bài đang ở dạng câu hỏi TIẾNG ANH (ví dụ: "Please try the exercise below", "Question", "Use this answer format: Answer: [your answer]").\n' +
        '• BẮT BUỘC trả lời hoàn toàn bằng TIẾNG ANH (trừ khi đề yêu cầu dịch sang tiếng Việt).\n' +
        '• Với câu hỏi trắc nghiệm (A, B, C, D): trả lời chính xác đáp án đúng (ví dụ: "A. Differences in musical tastes, career choices, and lifestyles" hoặc chỉ chữ cái nếu bật chế độ chỉ đáp án).\n' +
        '• Với câu hỏi điền từ, viết lại câu, đọc hiểu hoặc tự luận tiếng Anh: trả lời trực tiếp, ngắn gọn, đúng ngữ pháp bằng tiếng Anh.\n' +
        '• KHÔNG dùng markdown, KHÔNG dùng LaTeX, KHÔNG giải thích dài dòng bằng tiếng Việt.\n\n';

    const SYSTEM_PROMPT_CORE = 'Bạn là học sinh giỏi toán, lý, hoá, tiếng Anh. Trả lời ngắn gọn theo định dạng đề bài yêu cầu. Không markdown, không LaTeX. KHÔNG dùng ° — luôn viết "degree" (hoặc "độ"). Khi giải thích hoá học, dùng thuật ngữ tiếng Việt ("ion khán", "kết tủa", "dung dịch", "chất rắn"). CHỈ TRẢ LỜI ĐÚNG NỘI DUNG ĐÁP ÁN — KHÔNG thêm ID, mã câu trả lời, timestamp, hay bất kỳ thông tin kỹ thuật nào.';
    const VISION_EXTRA = '\n\n[ẢNH ĐÍNH KÈM] Đọc chữ trong ảnh. Nếu câu hỏi nằm trong ảnh hoặc nội dung văn bản gửi kèm chưa đủ, hãy tự trích câu hỏi từ ảnh rồi giải và trả lời theo đúng yêu cầu.';
    const MISTAKE_INSTRUCTION = '\n\n[BÍ MẬT] Lần này cố tình trả lời SAI.';
    const DIACRITIC_INSTRUCTION = '\n\n[BÍ MẬT] Viết tiếng Việt KHÔNG DẤU.';
    const ANTI_ID_INSTRUCTION = '\n\n[QUY TẮC] KHÔNG chèn ID, hex, UUID, mã câu trả lời, timestamp.';
    const ANTI_PREFIX_INSTRUCTION = '\n\n[QUY TẮC] KHÔNG mở đầu bằng "Trả lời:", "Đáp án:", "Answer:", "TL:".';
    const CONFIDENCE_INSTRUCTION = '\n\n[OUTPUT] Ở CUỐI câu trả lời, thêm dòng: [CONFIDENCE: X/10] với X là 1-10.';

    function hasTemplateRequirement(question = '') {
        const qStr = String(question || '').normalize('NFC').toLowerCase();
        const hasDirectReq = /theo\s*m[aãâẫ]u|m[aãâẫ]u\s*sau|tr[aả]\s*l[oờ]i\s*:\s*\[|m[aãâẫ]u\s*:\s*\[|điền.*theo\s*m[aãâẫ]u|answer\s*:\s*\[/i.test(qStr);
        if (hasDirectReq) return true;

        try {
            const chatContainers = document.querySelectorAll('.wrap-message-view, .chat-body, [class*="message-view"], [class*="chat_body"], [class*="exercise"]');
            for (const container of chatContainers) {
                const cText = (container.innerText || '').normalize('NFC').toLowerCase();
                if (/theo\s*m[aãâẫ]u|m[aãâẫ]u\s*sau|tr[aả]\s*l[oờ]i\s*:\s*\[|answer\s*:\s*\[/i.test(cText)) {
                    return true;
                }
            }
        } catch (_) {}

        return false;
    }

    function formatAnswerToRequiredTemplate(answer, questionText = '') {
        if (!answer) return answer;
        let clean = String(answer).trim();
        if (hasTemplateRequirement(questionText)) {
            clean = clean.replace(/^\s*(?:tr[aả]\s*l[oờ]i|d[aá]p\s*[aá]n|answer|tl)\s*:\s*/i, '').trim();
            clean = 'Trả lời: ' + clean;
        }
        return clean;
    }

    function buildSystemPrompt(intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, includeQuestionType, questionText, hasImages) {
        let s = '';
        const autoEng = isEnglishQuestion(questionText);
        const englishSubject = autoEng || (isSubjectDetectionOn() && lastSubject === 'english');
        if (autoEng) {
            s += SYSTEM_PROMPT_ENGLISH_AUTO_BLOCK;
        } else if (isForceVietnameseOn()) {
            if (englishSubject) {
                s += SYSTEM_PROMPT_ENGLISH_BLOCK;
            } else {
                s += SYSTEM_PROMPT_VIETNAMESE_BLOCK;
            }
        }
        s += SYSTEM_PROMPT_CORE;
        if (hasImages) s += VISION_EXTRA;
        if (!autoEng && isSubjectDetectionOn() && lastSubject && lastSubject !== 'generic') {
            const si = SUBJECT_INSTRUCTIONS[lastSubject];
            if (si) s += '\n\n' + si;
        }
        const custom = getCustomPrompt();
        if (custom) s += '\n\n[HƯỚNG DẪN RIÊNG — ưu tiên]\n' + custom;
        if (includeQuestionType && questionText) {
            const qT = detectQuestionType(questionText);
            const tI = QUESTION_TYPE_INSTRUCTIONS[qT];
            if (tI) s += ' ' + tI;
        }
        if (lengthInstruction) s += ' ' + lengthInstruction;
        if (!englishSubject && shouldApplyMathNotation(lastSubject)) s += ' ' + notationInstruction;
        if (!englishSubject && SETTINGS.physicsNotation !== 'off' && shouldApplyPhysicsNotation(lastSubject)) {
            const pi = resolvePhysicsNotationInstruction();
            if (pi) s += '\n\n[QUY TẮC KÝ HIỆU VẬT LÝ]\n' + pi;
        }
        if (!englishSubject && SETTINGS.chemNotation !== 'off' && shouldApplyChemNotation(lastSubject)) {
            const ci = resolveChemNotationInstruction();
            if (ci) s += '\n\n[QUY TẮC HOÁ HỌC]\n' + ci;
        }
        if (isFilterIdsOn()) s += ANTI_ID_INSTRUCTION;
        if (hasTemplateRequirement(questionText)) {
            s += '\n\n[QUAN TRỌNG - BẮT BUỘC ĐIỀN ĐÚNG MẪU ĐỀ BÀI]\nĐề bài có yêu cầu định dạng mẫu (ví dụ: "Trả lời: [đáp án của bạn]").\nBẮT BUỘC giữ nguyên cú pháp mẫu và trả lời đúng định dạng: "Trả lời: <kết quả>", KHÔNG bỏ chữ "Trả lời:".';
        } else if (isStripPrefixOn()) {
            s += ANTI_PREFIX_INSTRUCTION;
        }
        if (isConfidenceOn()) s += CONFIDENCE_INSTRUCTION;
        if (intentionalMistake) s += MISTAKE_INSTRUCTION;
        if (!englishSubject && intentionalNoDiacritic) s += DIACRITIC_INSTRUCTION;
        return s;
    }

    function applyAllSanitizers(content, intentionalNoDiacritic, slangLevel, questionText = '') {
        content = sanitizeUiChrome(content);
        if (!content) return '⚠️ Rỗng sau lọc UI.';
        content = sanitizeIds(content);
        if (content.startsWith('⚠️')) return content;
        if (!hasTemplateRequirement(questionText)) {
            content = stripReplyPrefix(content);
        } else {
            // Nếu đề bài yêu cầu mẫu "Trả lời: [đáp án của bạn]" mà AI chưa có "Trả lời:", tự động bổ sung
            if (!/^\s*(?:trả\s*lời|tra\s*loi|tl)\s*:/i.test(content)) {
                content = 'Trả lời: ' + content.trim();
            }
        }
        content = sanitizeDegreeSymbol(content);
        content = removeInternalThinking(content);
        content = applySlang(content, slangLevel);
        if (intentionalNoDiacritic) content = removeVietnameseDiacritics(content);
        return content;
    }

    function askAISingleRaw(question, temperature, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel, imagesOverride = null, keyOverride = null) {
        const keyEntry = keyOverride || getActiveKey();
        const trace = makeTrace(question);
        if (!keyEntry) {
            trace.error = 'Chưa có API Key';
            trace.steps.push({ label: 'Error', note: 'Không có key nào active hoặc model rỗng' });
            pushTrace(trace);
            showFailureNotification('Chưa có API Key hợp lệ', 'Vào 🔑 để thêm key và chọn model');
            return { content: '❌ Chưa có API Key hợp lệ.', confidence: null, keyUsed: null };
        }
        const trimmedQuestion = question.length > 3000 ? question.substring(0, 3000) + '...' : question;
        let images = imagesOverride;
        if (images === null && (isImageSupportOn() || pendingManualVisionImages.length)) { try { images = await scanImagesFromText(question); } catch (e) { images = []; } }
        else if (!images) images = [];
        let finalKey = keyEntry;
        if (images.length > 0 && !providerSupportsVision(keyEntry) && isImageAutoRouteOn()) {
            const vk = findVisionKey();
            if (vk) { finalKey = vk; sessionStats.routerSwitches++; logActivity('image', `Auto-route sang ${vk.name || finalKey.model} để đọc ảnh`); trace.steps.push({ label: 'Auto-route ảnh', note: `Sang ${vk.name || vk.model}` }); }
        }
        if (images.length > 0 && !providerSupportsVision(finalKey)) {
            logActivity('warn', `Đã có ảnh nhưng model ${finalKey.model || '(trống)'} không hỗ trợ vision; chọn Gemini/GPT-4o/Claude 3 hoặc bật Image Auto-route.`);
        }
        const hasImages = images.length > 0 && providerSupportsVision(finalKey);
        if (pendingManualVisionImages.length && !hasImages) {
            const error = `Model ${finalKey.model || '(trống)'} không hỗ trợ ảnh. Chọn Gemini, GPT-4o hoặc Claude 3 rồi thử chụp lại.`;
            trace.error = error;
            trace.steps.push({ label: '❌ Vision required', note: error });
            pushTrace(trace);
            logActivity('failed', error);
            return { content: '❌ ' + error, confidence: null, keyUsed: null };
        }
        const systemContent = buildSystemPrompt(intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, isQuestionTypeOn(), trimmedQuestion, hasImages);

        trace.model = finalKey.model;
        trace.provider = finalKey.provider;
        trace.keyName = finalKey.name || finalKey.provider;
        trace.steps.push({ label: '📤 Request', note: `Provider: ${finalKey.provider} · Model: ${finalKey.model}\nTemp: ${temperature} · Max tokens: ${computeMaxTokens()}\nẢnh: ${hasImages ? images.length : 0}` });
        const requestStartedAt = Date.now();
        if (hasImages) logActivity('question', `Đang gửi ${images.length} ảnh tới ${finalKey.provider}/${finalKey.model} (giới hạn 60 giây)`);
        trace.steps.push({ label: '🧠 System prompt', note: systemContent.substring(0, 900) });

        try {
            let content = await callProviderWithKey(finalKey, { system: systemContent, user: trimmedQuestion, temperature, maxTokens: hasImages ? Math.min(computeMaxTokens(), 700) : computeMaxTokens(), timeout: 60000, images: hasImages ? images : null });
            if (hasImages) logActivity('answer', `AI phản hồi sau ${((Date.now() - requestStartedAt) / 1000).toFixed(1)} giây`);
            if (hasImages && pendingManualVisionImages.length) pendingManualVisionImages = [];
            trace.rawResponse = content.substring(0, 800);
            trace.steps.push({ label: '📥 Raw response', note: content.substring(0, 800) });
            const parsed = parseConfidence(content);
            content = parsed.content;
            trace.confidence = parsed.confidence;
            const beforeSanitize = content;
            const sanitized = applyAllSanitizers(content, intentionalNoDiacritic, slangLevel, trimmedQuestion);
            trace.finalResponse = sanitized.substring(0, 800);
            if (beforeSanitize !== sanitized) {
                trace.steps.push({ label: '🧼 Sanitizers đã sửa', before: beforeSanitize.substring(0, 500), after: sanitized.substring(0, 500) });
            } else {
                trace.steps.push({ label: '🧼 Sanitizers', note: 'Không thay đổi gì' });
            }
            if (parsed.confidence !== null) trace.steps.push({ label: '📊 Confidence', note: `${parsed.confidence}/10` });
            trace.steps.push({ label: '✅ Final', note: sanitized.substring(0, 800) });
            pushTrace(trace);
            return { content: sanitized, confidence: parsed.confidence, keyUsed: finalKey };
        } catch (e) {
            const msg = e.message || 'Unknown error';
            trace.error = msg;
            if (hasImages) logActivity('failed', `Gửi ảnh thất bại sau ${((Date.now() - requestStartedAt) / 1000).toFixed(1)} giây: ${msg.substring(0, 140)}`);
            trace.steps.push({ label: '❌ Error', note: msg });
            pushTrace(trace);
            if (/rate.?limit|429/i.test(msg)) showFailureNotification('Rate limit', 'API đang giới hạn tốc độ');
            else if (/invalid.*api.*key|unauthorized|401/i.test(msg)) showFailureNotification('API Key không hợp lệ', 'Vào 🔑 để kiểm tra');
            else if (/quota|exceeded/i.test(msg)) showFailureNotification('Hết quota', 'Đã dùng hết hạn mức');
            else if (/timeout/i.test(msg)) showFailureNotification('Timeout', 'Request quá 60s');
            else if (/network|connect/i.test(msg)) showFailureNotification('Lỗi kết nối', 'Không gửi được request');
            else showFailureNotification('API lỗi', msg.substring(0, 100));
            return { content: `❌ ${msg}`, confidence: null, keyUsed: finalKey };
        }
    }
    async function askAISingle(question, temperature, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel) {
        const r = await askAISingleRaw(question, temperature, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel);
        lastConfidence = r.confidence;
        return r.content;
    }

    async function askAIEnsemble(cleanQuestion, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel) {
        const countMap = { three: 3, five: 5 };
        const count = countMap[SETTINGS.ensembleCount] || 3;
        const strategy = SETTINGS.ensembleStrategy || 'majority';
        const smart = getSmartness();
        const multiModel = isMultiModelOn();
        setStatus('thinking');
        let keys = [];
        if (multiModel) {
            if (isRouterOn()) {
                keys = routerSelectKeys(cleanQuestion, count);
                logActivity('router', `Router chọn: ${keys.map(k => k.model).join(', ')}`);
            } else {
                const allKeys = (SETTINGS.keys || []).filter(k => k.enabled !== false);
                const sh = [...allKeys].sort(() => Math.random() - 0.5);
                keys = [];
                for (let i = 0; i < count; i++) keys.push(sh[i % Math.max(1, sh.length)] || getActiveKey());
            }
        } else {
            const a = getActiveKey();
            for (let i = 0; i < count; i++) keys.push(a);
        }
        const modelList = [...new Set(keys.map(k => k?.model).filter(Boolean))];
        logActivity('ensemble', `${multiModel ? 'ĐA MODEL' : 'cùng model'} × ${count}: ${modelList.join(' | ')}`);
        showToast(`🗳️ Ensemble ${multiModel ? '(đa model)' : ''}: ${count} lần...`, 'info', 2000);
        const promises = [];
        for (let i = 0; i < count; i++) {
            const temp = Math.min(1.0, smart.temperature + i * 0.08);
            promises.push(askAISingleRaw(cleanQuestion, temp, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel, null, keys[i]));
        }
        const results = await Promise.all(promises);
        const votes = {};
        const errors = [];
        results.forEach(r => {
            if (!r.content || r.content.startsWith('❌')) { errors.push(r.content || 'empty'); return; }
            const key = normalizeAnswerForVote(r.content);
            if (!votes[key]) votes[key] = { count: 0, answer: r.content, confidences: [], models: [] };
            votes[key].count++;
            if (r.confidence !== null && r.confidence !== undefined) votes[key].confidences.push(r.confidence);
            if (r.keyUsed?.model) votes[key].models.push(r.keyUsed.model);
        });
        const totalValid = count - errors.length;
        if (totalValid === 0) { lastConfidence = null; showFailureNotification('Ensemble thất bại', `Cả ${count} lần lỗi`); return errors[0] || '❌ Tất cả lần gọi thất bại.'; }
        const sorted = Object.entries(votes).sort((a, b) => b[1].count - a[1].count);
        const [topKey, top] = sorted[0];
        const topRatio = top.count / totalValid;
        logActivity('ensemble', `Vote: ${top.count}/${totalValid} chọn "${topKey.substring(0, 50)}"`, { detail: sorted.map(([k, v]) => `• ${v.count} phiếu: "${k}"\n  Models: ${v.models.join(', ')}`).join('\n') });
        if (strategy === 'unanimous' && top.count < totalValid) { confidencePaused = true; showToast(`🗳️ Không đồng thuận (${top.count}/${totalValid}) — tạm dừng`, 'warn', 5000); return top.answer; }
        if (strategy === 'pause' && sorted.length > 1) { confidencePaused = true; showToast(`🗳️ Chia rẽ ${sorted.length} đáp án — tạm dừng`, 'warn', 5000); return top.answer; }
        let bestConfidence = null;
        if (top.confidences.length > 0) { bestConfidence = Math.round(top.confidences.reduce((a, b) => a + b, 0) / top.confidences.length); if (top.count === totalValid && totalValid >= 3) bestConfidence = Math.max(bestConfidence, 9); }
        if (topRatio < 0.6) bestConfidence = Math.min(bestConfidence ?? 5, 4);
        lastConfidence = bestConfidence;
        showToast(`🗳️ Ensemble: ${top.count}/${totalValid} đồng ý (${Math.round(topRatio * 100)}%)`, topRatio >= 0.66 ? 'success' : 'warn', 2500);
        return top.answer;
    }
    async function recheckAnswerOnce(question, answer, temperature) {
        const keyEntry = getActiveKey();
        if (!keyEntry) return { verdict:'UNKNOWN', corrected:null, error:'Chưa có API Key.' };
        const uc = '=== ĐỀ BÀI ===\n' + (question.length > 2000 ? question.substring(0, 2000) + '...' : question) + '\n\n=== ĐÁP ÁN ===\n' + answer;
        const custom = getCustomPrompt();
        const rs = custom ? RECHECK_SYSTEM_PROMPT + '\n\n[GHI CHÚ]\n' + custom : RECHECK_SYSTEM_PROMPT;
        try { const text = await callProvider({ system: rs, user: uc, temperature, maxTokens: Math.max(256, Math.min(1024, computeMaxTokens())), timeout: 45000 }); return parseRecheckResponse(text); }
        catch (e) { return { verdict:'UNKNOWN', corrected:null, error:e.message }; }
    }
    function parseRecheckResponse(text) {
        if (!text) return { verdict:'UNKNOWN', corrected:null };
        let verdict = 'UNKNOWN';
        const vM = text.match(/VERDICT\s*[:\-]\s*([A-ZÀ-ỸĐ]+)/i);
        if (vM) { const v = stripDiacritics(vM[1]).toUpperCase(); if (v.includes('CORRECT') || v === 'DUNG') verdict = 'CORRECT'; else if (v.includes('WRONG') || v === 'SAI') verdict = 'WRONG'; }
        if (verdict === 'UNKNOWN') { if (/\bCORRECT\b/i.test(text) || /\bĐÚNG\b/i.test(text)) verdict = 'CORRECT'; else if (/\bWRONG\b/i.test(text) || /\bSAI\b/i.test(text)) verdict = 'WRONG'; }
        let corrected = null;
        const cM = text.match(/CORRECTED\s*[:\-]\s*(.+?)(?:\n\n|\n(?=[A-Z][A-Z ]*:)|$)/is);
        if (cM) { corrected = cM[1].trim().replace(/^["'`]|["'`]$/g, '').trim(); if (!corrected) corrected = null; }
        return { verdict, corrected };
    }
    async function recheckAnswer(question, initialAnswer, intentionalMistake, force = false) {
        const recheck = getRecheck();
        if (recheck.maxPasses === 0 && !force) return { final: initialAnswer, passes: 0, changed: false };
        if (intentionalMistake) return { final: initialAnswer, passes: 0, changed: false, skipped: true };
        const maxPasses = force ? Math.max(recheck.maxPasses, 1) : recheck.maxPasses;
        let current = initialAnswer, passes = 0, changed = false;
        for (let i = 0; i < maxPasses; i++) {
            if (!isRunning) break;
            passes++;
            const result = await recheckAnswerOnce(question, current, recheck.temp);
            if (result.error) break;
            if (result.verdict === 'CORRECT') break;
            if (result.verdict === 'WRONG' && result.corrected) {
                let fixed = sanitizeIds(sanitizeUiChrome(result.corrected));
                if (fixed.startsWith('❌')) break;
                fixed = stripReplyPrefix(fixed);
                fixed = sanitizeDegreeSymbol(fixed);
                if (shouldApplyMathNotation(lastSubject)) fixed = sanitizeMathSymbols(fixed);
                if (shouldApplyChemNotation(lastSubject)) fixed = sanitizeChemSymbols(fixed);
                if (shouldApplyPhysicsNotation(lastSubject)) fixed = sanitizePhysicsSymbols(fixed);
                fixed = sanitizeUiChrome(fixed);
                current = fixed; changed = true;
            } else break;
        }
        return { final: current, passes, changed };
    }

    function normalizeAnswerForComposer(text) {
        return String(text ?? '')
            .normalize('NFC')
            .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
            .replace(/^\s{0,3}#{1,6}\s+/gm, '')
            .replace(/\\(?:d?frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2')
            .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
            .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
            .replace(/__([\s\S]*?)__/g, '$1')
            .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
            .replace(/`([^`\n]+)`/g, '$1')
            .replace(/~~([\s\S]*?)~~/g, '$1')
            .replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, '$1')
            .replace(/\\(?:begin|end)\{(?:aligned|array|cases|equation\*?)\}/g, '')
            .replace(/\\(?:times|cdot|div|pm|neq|leq|geq|approx|rightarrow|to)\b/g, cmd => ({
                '\\times': ' × ', '\\cdot': ' · ', '\\div': ' ÷ ', '\\pm': ' ± ',
                '\\neq': ' ≠ ', '\\leq': ' ≤ ', '\\geq': ' ≥ ', '\\approx': ' ≈ ',
                '\\rightarrow': ' → ', '\\to': ' → '
            }[cmd] || cmd))
            .replace(/\\(?:alpha|beta|gamma|delta|theta|lambda|mu|omega|pi|sigma|Delta|Omega)\b/g, cmd => ({
                '\\alpha':'α', '\\beta':'β', '\\gamma':'γ', '\\delta':'δ', '\\theta':'θ',
                '\\lambda':'λ', '\\mu':'μ', '\\omega':'ω', '\\pi':'π', '\\sigma':'σ',
                '\\Delta':'Δ', '\\Omega':'Ω'
            }[cmd] || cmd))
            .replace(/\$([^$\n]+)\$/g, '$1')
            .replace(/\\(?:left|right|displaystyle|textstyle|quad|qquad)\b|\\[,;!]/g, '')
            .replace(/\\([A-Za-z]+)\b/g, '$1')
            .replace(/\\([\[\](){}])/g, '$1')
            .replace(/\*\*/g, '')
            .replace(/&nbsp;|\u00a0/gi, ' ')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2060\uFEFF\uFFFD\uE000-\uF8FF]/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    async function askAI(question, allowMistake, allowNoDiacritic, allowRandomNotation, allowSlang, fastMode = false) {
        confidencePaused = false;
        const smart = getSmartness();
        const visionRequest = pendingManualVisionImages.length > 0;
        // Do not stack retries for image calls; surface the provider error promptly.
        const maxRetry = (visionRequest || fastMode) ? 0 : smart.retry;
        const dia = getDiacritic();
        const len = getResponseLength();
        const cleanQuestion = sanitizeQuestion(question);
        const skipCache = pendingManualVisionImages.length > 0 || (allowMistake && getMistake().chance > 0) || (allowSlang && getSlang().chance > 0);
        if (isCacheOn() && !skipCache && cleanQuestion) {
            const cached = cacheLookup(cleanQuestion);
            if (cached.hit) {
                sessionStats.cacheHits++;
                const c = loadCache(); c.hits = (c.hits || 0) + 1; saveCache();
                const estIn = Math.round(cleanQuestion.length / 4);
                const estOut = Math.round((cached.answer || '').length / 4);
                sessionStats.savedTokens += estIn + estOut;
                sessionStats.savedCost += estimateCost(getModel(), estIn, estOut);
                logActivity('cached', `Cache ${cached.hitType} — tiết kiệm ~${estIn + estOut} tokens`);
                if (isCacheShowHitOn()) showToast(`⚡ Cache ${cached.hitType} hit`, 'success', 2000);
                lastConfidence = 10;
                setStatus('cached');
                const t = makeTrace(cleanQuestion);
                t.cacheHit = cached.hitType;
                t.finalResponse = (cached.answer || '').substring(0, 800);
                t.steps.push({ label: '⚡ Cache hit', note: `Loại: ${cached.hitType}\nTiết kiệm ~${estIn + estOut} tokens\nKhông gọi API` });
                t.steps.push({ label: '✅ Final (từ cache)', note: (cached.answer || '').substring(0, 800) });
                pushTrace(t);
                return normalizeAnswerForComposer(cached.answer);
            } else sessionStats.cacheMisses++;
        }
        let intentionalMistake = false;
        if (allowMistake) { const ch = getMistake().chance; if (ch > 0) intentionalMistake = Math.random() < ch; }
        let intentionalNoDiacritic = false;
        if (dia.always) intentionalNoDiacritic = true;
        else if (allowNoDiacritic && dia.chance > 0) intentionalNoDiacritic = Math.random() < dia.chance;
        const slang = getSlang();
        let slangLevel = 'none';
        if (slang.always) slangLevel = slang.level;
        else if (allowSlang && slang.chance > 0) slangLevel = Math.random() < slang.chance ? slang.level : 'none';
        const notationInstruction = allowRandomNotation ? resolveNotationInstruction() : NOTATION_PRESETS.symbols.instruction;
        const lengthInstruction = fastMode ? 'TRẢ LỜI NGẮN, CHỈ ĐÁP ÁN THEO MẪU.' : len.instruction;
        let detectedImages = [];
        if (isImageSupportOn() || pendingManualVisionImages.length) { try { detectedImages = await scanImagesFromText(cleanQuestion); } catch (e) { detectedImages = []; } if (detectedImages.length > 0) { sessionStats.imageScans++; logActivity('image', `Phát hiện ${detectedImages.length} ảnh`); } }
        let answer = null;
        if (isEnsembleOn() && !visionRequest && !fastMode) {
            answer = await askAIEnsemble(cleanQuestion, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel);
            if (confidencePaused) return answer;
            if (!answer || answer.startsWith('❌')) {
                for (let i = 0; i <= maxRetry; i++) {
                    lastConfidence = null;
                    const temp = i === 0 ? smart.temperature : smart.temperature + 0.2 + i * 0.1;
                    const resp = await askAISingle(cleanQuestion, temp, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel);
                    if (resp && !resp.startsWith('❌')) { answer = resp; break; }
                    if (i < maxRetry) await new Promise(r => setTimeout(r, 2000)); else { answer = resp; break; }
                }
            }
        } else {
            for (let i = 0; i <= maxRetry; i++) {
                lastConfidence = null;
                const temp = i === 0 ? smart.temperature : smart.temperature + 0.2 + i * 0.1;
                const resp = await askAISingle(cleanQuestion, temp, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel);
                if (resp && !resp.startsWith('❌')) { answer = resp; break; }
                if (i < maxRetry) await new Promise(r => setTimeout(r, 2000)); else { answer = resp; break; }
            }
        }
        if (confidencePaused) return answer;
        if (!answer || answer.startsWith('❌')) return answer;
        const skipVnRetry = (isSubjectDetectionOn() && lastSubject === 'english') || lastSubject === 'english' || isEnglishQuestion(cleanQuestion);
        if (!visionRequest && !fastMode && isForceVietnameseOn() && !skipVnRetry && isLikelyEnglish(answer)) {
            const strictness = getVietnameseStrictness();
            const maxRetries = strictness === 'strict' ? 2 : (strictness === 'normal' ? 1 : 0);
            if (maxRetries > 0) {
                for (let vnTry = 0; vnTry < maxRetries && isLikelyEnglish(answer); vnTry++) {
                    logActivity('retry', `Phát hiện tiếng Anh — retry ${vnTry + 1}/${maxRetries}`);
                    showToast(`🇻🇳 Đáp án tiếng Anh — thử lại (${vnTry + 1}/${maxRetries})`, 'warn', 3000);
                    const sq = cleanQuestion + '\n\n[QUAN TRỌNG — SỬA LẠI NGÔN NGỮ]\nĐáp án trước đó chứa TIẾNG ANH.\n1. Viết lại CÂU VĂN XUÔI bằng tiếng Việt.\n2. GIỮ NGUYÊN công thức hoá học (NH3, H2O).\n3. GIỮ NGUYÊN ký hiệu toán/vật lý.\n4. GIỮ NGUYÊN đơn vị SI.\n5. GIỮ NGUYÊN chữ cái trắc nghiệm (A, B, C, D).\nKHÔNG dịch công thức.]';
                    const vnTemp = Math.max(0.1, smart.temperature - 0.15);
                    const rr = await askAISingle(sq, vnTemp, intentionalMistake, intentionalNoDiacritic, notationInstruction, lengthInstruction, slangLevel);
                    if (rr && !rr.startsWith('❌')) answer = rr;
                }
            }
        }
        const lowConf = isConfidenceOn() && lastConfidence !== null && lastConfidence < getConfidenceThreshold();
        if (lowConf && SETTINGS.confidenceAction === 'pause') { confidencePaused = true; return answer; }
        const forceRecheck = lowConf && SETTINGS.confidenceAction === 'recheck';
        if (forceRecheck) showToast(`⚠️ Confidence thấp (${lastConfidence}/10) — chạy recheck`, 'warn', 3000);
        const rechecked = (visionRequest || fastMode)
            ? { final: answer, passes: 0, changed: false }
            : await recheckAnswer(cleanQuestion, answer, intentionalMistake, forceRecheck);
        const finalAnswer = normalizeAnswerForComposer(rechecked.final);
        if (rechecked.passes > 0 || rechecked.changed) {
            const last = decisionTraces[decisionTraces.length - 1];
            if (last) {
                last.recheck = { passes: rechecked.passes, changed: rechecked.changed };
                last.steps.push({ label: '🔍 Recheck', before: (answer||'').substring(0,500), after: (finalAnswer||'').substring(0,500), note: `${rechecked.passes} pass(es) · changed=${rechecked.changed}` });
            }
        }
        if (isCacheOn() && !skipCache && !intentionalMistake && finalAnswer && !finalAnswer.startsWith('❌')) cacheStore(cleanQuestion, finalAnswer, lastSubject, lastConfidence);
        return finalAnswer;
    }
    async function askAIWithFailRetry(question, allowMistake, allowNoDiacritic, allowRandomNotation, allowSlang, fastMode = false) {
        if (fastMode || pendingManualVisionImages.length > 0) {
            // Fast mode uses one model pass; image requests also avoid stacked retries.
            return await askAI(question, allowMistake, allowNoDiacritic, allowRandomNotation, allowSlang, fastMode);
        }
        const preset = getFailRetry();
        if (preset.maxAttempts === 0) return await askAI(question, allowMistake, allowNoDiacritic, allowRandomNotation, allowSlang, fastMode);
        let attempt = 0, delay = preset.baseDelay, lastAnswer = null;
        while (isRunning) {
            attempt++;
            lastAnswer = await askAI(question, allowMistake, allowNoDiacritic, allowRandomNotation, allowSlang);
            if (confidencePaused) return lastAnswer;
            if (lastAnswer && !lastAnswer.startsWith('❌')) { if (attempt > 1) showToast(`Thử lại thành công sau ${attempt} lần`, 'success', 2500); return lastAnswer; }
            if (attempt >= preset.maxAttempts) { showFailureNotification(`Thử lại thất bại sau ${attempt} lần`, 'Kiểm tra kết nối hoặc key'); return lastAnswer; }
            const rl = /rate.?limit|429/i.test(lastAnswer || '');
            let wait = rl ? delay * 2 : delay;
            if (rl) showToast('Rate limit — chờ gấp đôi', 'warn', 2500);
            const cancelled = await new Promise(resolve => { const start = Date.now(); const tick = () => { if (!isRunning) { resolve(true); return; } if (Date.now() - start >= wait) { resolve(false); return; } setTimeout(tick, Math.min(500, wait - (Date.now() - start))); }; tick(); });
            if (cancelled) return lastAnswer;
            delay = Math.round(delay * preset.backoffFactor);
        }
        return '❌ Auto Chat tắt.';
    }

    // ============================================================
    // STATS / PLAYGROUND
    // ============================================================
    function formatTokens(n) { if (n === 0) return '0'; if (n < 1000) return String(n); if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k'; return (n / 1_000_000).toFixed(2) + 'M'; }
    function formatCost(usd) { if (usd === 0) return '$0.0000'; if (usd < 0.001) return '$' + usd.toFixed(5); if (usd < 1) return '$' + usd.toFixed(4); return '$' + usd.toFixed(2); }

    function showStatsDialog() {
        document.getElementById('ac-stats-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-stats-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '720px';

        function render() {
            const s = sessionStats;
            const duration = Date.now() - s.startTime;
            const totalTokens = s.tokensIn + s.tokensOut;
            const firstTryRate = s.questions > 0 ? Math.round(((s.questions - s.retries) / s.questions) * 100) : 0;
            const activeKey = getActiveKey();
            const activeProvider = activeKey ? PROVIDERS[activeKey.provider] : null;
            const cStats = cacheStats();
            const totalLookups = s.cacheHits + s.cacheMisses;
            const hitRate = totalLookups > 0 ? Math.round((s.cacheHits / totalLookups) * 100) : 0;
            const modelRows = Object.entries(s.byModel).length === 0
                ? '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">Chưa có dữ liệu</div>'
                : Object.entries(s.byModel).map(([model, m]) => `<div class="ac-model-row"><div style="flex:1;min-width:0;"><div style="font-weight:600;color:#0f172a;font-family:ui-monospace,monospace;font-size:11.5px;">${model}</div><div style="font-size:11px;color:#64748b;">${m.label} · ${m.calls} calls</div></div><div style="text-align:right;flex-shrink:0;"><div style="font-family:ui-monospace,monospace;font-size:11.5px;">${formatTokens(m.tokensIn)} in · ${formatTokens(m.tokensOut)} out</div><div style="font-size:11px;font-weight:700;color:${m.cost > 0 ? '#059669' : '#94a3b8'};">${formatCost(m.cost)}</div></div></div>`).join('');
            box.innerHTML = `
                <div class="ac-dialog-header"><div><h3 class="ac-dialog-title">📊 AI Stats</h3><p class="ac-dialog-subtitle">Phiên này bắt đầu lúc ${new Date(s.startTime).toLocaleTimeString('vi-VN')}</p></div><button class="ac-dialog-close" id="stats-close-x">×</button></div>
                <div class="ac-dialog-body">
                    <div class="ac-stat-grid">
                        <div class="ac-stat-card"><div class="ac-stat-label">Câu hỏi</div><div class="ac-stat-value">${s.questions}</div><div class="ac-stat-sub">${s.retries} cần retry</div></div>
                        <div class="ac-stat-card"><div class="ac-stat-label">Đúng lần đầu</div><div class="ac-stat-value" style="color:${firstTryRate >= 80 ? '#059669' : firstTryRate >= 60 ? '#f59e0b' : '#dc2626'};">${firstTryRate}%</div><div class="ac-stat-sub">${s.questions - s.retries}/${s.questions}</div></div>
                        <div class="ac-stat-card"><div class="ac-stat-label">Thời gian</div><div class="ac-stat-value">${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s</div><div class="ac-stat-sub">${s.calls} API calls</div></div>
                    </div>
                    <div class="ac-stat-grid">
                        <div class="ac-stat-card"><div class="ac-stat-label">⚡ Cache hits</div><div class="ac-stat-value" style="color:#f59e0b;">${s.cacheHits}</div><div class="ac-stat-sub">${hitRate}% · ${s.cacheMisses} miss</div></div>
                        <div class="ac-stat-card"><div class="ac-stat-label">💾 Cache size</div><div class="ac-stat-value" style="color:#6366f1;">${cStats.valid}</div><div class="ac-stat-sub">${cStats.expired} hết hạn · ${cStats.totalHits} hits</div></div>
                        <div class="ac-stat-card"><div class="ac-stat-label">💰 Tiết kiệm</div><div class="ac-stat-value" style="color:#059669;">${formatCost(s.savedCost)}</div><div class="ac-stat-sub">~${formatTokens(s.savedTokens)} tokens</div></div>
                    </div>
                    <div class="ac-stat-grid">
                        <div class="ac-stat-card"><div class="ac-stat-label">🖼️ Image</div><div class="ac-stat-value">${s.imageScans}</div><div class="ac-stat-sub">Vision queries</div></div>
                        <div class="ac-stat-card"><div class="ac-stat-label">🎯 Router</div><div class="ac-stat-value">${s.routerSwitches}</div><div class="ac-stat-sub">Auto-routing</div></div>
                        <div class="ac-stat-card"><div class="ac-stat-label">💰 Chi phí</div><div class="ac-stat-value" style="color:${s.cost > 0.01 ? '#dc2626' : s.cost > 0 ? '#f59e0b' : '#059669'};">${formatCost(s.cost)}</div><div class="ac-stat-sub">${totalTokens > 0 ? formatTokens(totalTokens) + ' tokens' : ''}</div></div>
                    </div>
                    <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🎯</span>Model đang dùng</h4><div class="ac-info"><span>${activeProvider?.emoji || '🔑'}</span><span style="flex:1;"><b>${activeKey?.name || 'Chưa có key'}</b><br><span style="font-size:11px;font-family:ui-monospace,monospace;color:#64748b;">${activeKey?.model || '(không có)'}${activeProvider?.supportsVision ? ' · 👁️ vision' : ''}</span></span></div></div>
                    <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">💵</span>Chi tiết theo model</h4><div style="border:1.5px solid var(--ac-border); border-radius:11px; overflow:hidden; background:#fff;">${modelRows}</div></div>
                </div>
                <div class="ac-dialog-footer"><button class="ac-btn ac-btn-secondary" id="stats-cache" style="margin-right:auto;">💾 Cache</button><button class="ac-btn ac-btn-secondary" id="stats-free">🆓 Live Models</button><button class="ac-btn ac-btn-secondary" id="stats-playground">🎮 Playground</button><button class="ac-btn ac-btn-danger" id="stats-reset">🔄 Reset</button><button class="ac-btn ac-btn-primary" id="stats-close">Đóng</button></div>
            `;
            const close = () => overlay.remove();
            document.getElementById('stats-close').onclick = close;
            document.getElementById('stats-close-x').onclick = close;
            document.getElementById('stats-playground').onclick = () => { overlay.remove(); showPromptPlaygroundDialog(); };
            document.getElementById('stats-cache').onclick = () => { overlay.remove(); showCacheManagerDialog(); };
            document.getElementById('stats-free').onclick = () => { overlay.remove(); showFreeModelsDialog(); };
            document.getElementById('stats-reset').onclick = () => { if (!confirm('Reset toàn bộ thống kê session?')) return; resetSessionStats(); showToast('Đã reset', 'success', 2000); render(); };
        }
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        render();
    }

    function showPromptPlaygroundDialog() {
        document.getElementById('ac-playground-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-playground-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '760px';
        const activeKey = getActiveKey();
        const provider = activeKey ? PROVIDERS[activeKey.provider] : null;
        box.innerHTML = `
            <div class="ac-dialog-header"><div><h3 class="ac-dialog-title">🎮 Prompt Playground</h3><p class="ac-dialog-subtitle">${provider?.emoji || '🔑'} ${activeKey?.model || '(no key)'}${provider?.supportsVision ? ' · 👁️' : ''}</p></div><button class="ac-dialog-close" id="pg-close-x">×</button></div>
            <div class="ac-dialog-body">
                <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">❓</span>Câu hỏi test</h4><textarea id="pg-question" class="ac-textarea" rows="4" placeholder="Nhập câu hỏi..." spellcheck="false"></textarea><label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-top:9px;"><input type="checkbox" id="pg-images" checked style="accent-color:#6366f1;"> 🖼️ Đọc ảnh</label></div>
                <div class="ac-section"><div class="ac-info" style="flex-direction:column;align-items:flex-start;gap:6px;"><div style="display:flex;flex-wrap:wrap;gap:12px;font-size:11.5px;"><span>Smartness: <b>${getSmartness().label}</b></span><span>Math: <b>${getNotation().label}</b></span><span>Physics: <b>${getPhysicsNotation().label}</b></span><span>Chem: <b>${getChemNotation().label}</b></span><span>VN: <b>${isForceVietnameseOn() ? 'Bắt buộc' : 'Tự do'}</b></span><span>Cache: <b>${isCacheOn() ? 'Bật' : 'Tắt'}</b></span></div></div>
                    <div style="display:flex;gap:12px;margin-top:11px;flex-wrap:wrap;"><label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;"><input type="checkbox" id="pg-track" checked style="accent-color:#6366f1;"> Đếm stats</label><label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;"><input type="checkbox" id="pg-recheck" style="accent-color:#6366f1;"> Recheck</label><label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;"><input type="checkbox" id="pg-skipcache" style="accent-color:#6366f1;"> Bỏ cache</label></div>
                </div>
                <div id="pg-results" style="display:none;">
                    <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📥</span>Raw</h4><div id="pg-raw" class="ac-pg-panel"></div></div>
                    <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🧼</span>Sanitized</h4><div id="pg-final" class="ac-pg-panel" style="background:#ecfdf5;border-color:#a7f3d0;"></div></div>
                    <div class="ac-section" id="pg-recheck-section" style="display:none;"><h4 class="ac-section-title"><span class="ac-section-emoji">🔍</span>Recheck</h4><div id="pg-recheck-out" class="ac-pg-panel"></div></div>
                </div>
                <div id="pg-status" class="ac-status"></div>
            </div>
            <div class="ac-dialog-footer"><button class="ac-btn ac-btn-secondary" id="pg-clear" style="margin-right:auto;">🗑️ Xoá</button><button class="ac-btn ac-btn-secondary" id="pg-close">Đóng</button><button class="ac-btn ac-btn-primary" id="pg-run">▶️ Run</button></div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const qEl = document.getElementById('pg-question');
        const trEl = document.getElementById('pg-track');
        const rcEl = document.getElementById('pg-recheck');
        const skEl = document.getElementById('pg-skipcache');
        const imEl = document.getElementById('pg-images');
        const stEl = document.getElementById('pg-status');
        const rsEl = document.getElementById('pg-results');
        const rwEl = document.getElementById('pg-raw');
        const fnEl = document.getElementById('pg-final');
        const rcsEl = document.getElementById('pg-recheck-section');
        const rcoEl = document.getElementById('pg-recheck-out');
        const close = () => overlay.remove();
        document.getElementById('pg-close').onclick = close;
        document.getElementById('pg-close-x').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('pg-clear').onclick = () => { qEl.value = ''; rsEl.style.display = 'none'; stEl.textContent = ''; };
        document.getElementById('pg-run').onclick = async () => {
            const q = qEl.value.trim();
            if (!q) { stEl.style.color = '#dc2626'; stEl.textContent = '❌ Chưa nhập câu hỏi.'; return; }
            const keyEntry = getActiveKey();
            if (!keyEntry) { stEl.style.color = '#dc2626'; stEl.textContent = '❌ Chưa có key hợp lệ.'; return; }
            stEl.style.color = '#6366f1'; stEl.textContent = '⏳ Đang gọi...';
            rsEl.style.display = 'none';
            const t0 = Date.now();
            try {
                if (isSubjectDetectionOn()) lastSubject = detectSubject(q); else lastSubject = 'generic';
                if (isCacheOn() && !skEl.checked) {
                    const cached = cacheLookup(q);
                    if (cached.hit) {
                        rwEl.textContent = `[CACHE ${cached.hitType}]\n\n${cached.answer}`;
                        fnEl.textContent = cached.answer;
                        rcsEl.style.display = 'none'; rsEl.style.display = '';
                        const e = ((Date.now() - t0) / 1000).toFixed(2);
                        stEl.style.color = '#f59e0b'; stEl.textContent = `⚡ Cache ${cached.hitType} (${e}s)`;
                        return;
                    }
                }
                const smart = getSmartness(); const len = getResponseLength();
                const ni = resolveNotationInstruction();
                const imgs = imEl.checked ? await scanImagesFromText(q) : [];
                const hasImgs = imgs.length > 0 && providerSupportsVision(keyEntry);
                const sys = buildSystemPrompt(false, false, ni, len.instruction, isQuestionTypeOn(), q, hasImgs);
                const raw = await callProvider({ system: sys, user: q, temperature: smart.temperature, maxTokens: computeMaxTokens(), timeout: 60000, track: trEl.checked, images: hasImgs ? imgs : null });
                const parsed = parseConfidence(raw);
                const finalText = applyAllSanitizers(parsed.content, false, 'none', q);
                const e = ((Date.now() - t0) / 1000).toFixed(2);
                const vn = (isForceVietnameseOn() && isLikelyEnglish(parsed.content)) ? ' ⚠️ EN' : '';
                const imgF = hasImgs ? `\n🖼️ Đã đọc ${imgs.length} ảnh` : (imgs.length > 0 ? `\n🖼️ ${imgs.length} ảnh (model không vision)` : '');
                rwEl.textContent = raw + (parsed.confidence !== null ? `\n\n[conf: ${parsed.confidence}/10]` : '') + (isSubjectDetectionOn() ? `\n[subject: ${SUBJECT_EMOJI[lastSubject]} ${lastSubject}]` : '') + imgF + (vn ? `\n[${vn}]` : '');
                fnEl.textContent = finalText;
                rcsEl.style.display = 'none';
                if (isCacheOn() && !skEl.checked && !finalText.startsWith('❌')) { cacheStore(q, finalText, lastSubject, parsed.confidence); stEl.textContent = `✅ Xong ${e}s — đã cache`; }
                else stEl.textContent = `✅ Xong ${e}s`;
                if (rcEl.checked && !finalText.startsWith('❌')) {
                    stEl.textContent = '⏳ Recheck...';
                    const v = await recheckAnswerOnce(q, finalText, 0.1);
                    rcsEl.style.display = '';
                    if (v.error) rcoEl.textContent = '❌ ' + v.error;
                    else if (v.verdict === 'CORRECT') { rcoEl.textContent = '✅ CORRECT'; rcoEl.style.background = '#ecfdf5'; }
                    else if (v.verdict === 'WRONG') { rcoEl.textContent = `❌ WRONG\nCORRECTED: ${v.corrected || '(none)'}`; rcoEl.style.background = '#fef2f2'; }
                }
                rsEl.style.display = ''; stEl.style.color = '#059669';
            } catch (e) { stEl.style.color = '#dc2626'; stEl.textContent = '❌ ' + e.message; }
        };
        setTimeout(() => qEl.focus(), 100);
    }

    // ============================================================
    // SETTINGS DIALOG
    // ============================================================
    function showSettingsDialog() {
        document.getElementById('auto-chat-settings-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'auto-chat-settings-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '800px';

        const makeGroup = (name, presets, current, emoji, title, desc, accent) => {
            const opts = Object.entries(presets).map(([key, p]) => `<label class="ac-option" style="--ac-opt-accent:${accent};--ac-opt-bg:${accent}14;"><input type="radio" name="${name}" value="${key}" ${String(current) === String(key) ? 'checked' : ''}><span class="ac-opt-label">${p.label}</span><span class="ac-opt-desc">${p.desc || ''}</span></label>`).join('');
            return `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">${emoji}</span>${title}</h4><p class="ac-section-desc">${desc}</p>${opts}</div>`;
        };
        const inlineRadio = (name, presets, current, desc, accent) => {
            const opts = Object.entries(presets).map(([key, p]) => `<label class="ac-option" style="--ac-opt-accent:${accent};--ac-opt-bg:${accent}14;"><input type="radio" name="${name}" value="${key}" ${String(current) === String(key) ? 'checked' : ''}><span class="ac-opt-label">${p.label}</span><span class="ac-opt-desc">${p.desc || ''}</span></label>`).join('');
            return `<div style="margin-bottom:14px;">${opts}${desc ? `<p style="margin:6px 0 0;font-size:11.5px;color:#64748b;">${desc}</p>` : ''}</div>`;
        };

        const active = getActiveKey();
        const provider = active ? PROVIDERS[active.provider] : null;
        const keyCount = (SETTINGS.keys || []).length;
        const cStats = cacheStats();
        const modelDisplay = active?.model && String(active.model).trim()
            ? `<span style="font-family:ui-monospace,monospace;">${active.model}</span>`
            : `<span style="font-family:ui-monospace,monospace;color:#dc2626;font-weight:700;">⚠️ CHƯA CÓ MODEL</span>`;
        const keyStatus = active
            ? `<div style="padding:13px 15px;border:1.5px solid #6366f1;border-radius:11px;background:#eef2ff;display:flex;align-items:center;gap:13px;"><div style="font-size:23px;">${provider?.emoji || '🔑'}</div><div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#0f172a;">${active.name || provider?.label}${provider?.supportsVision ? ' 👁️' : ''}</div><div style="font-size:11px;color:#64748b;">${provider?.label || '?'} · ${modelDisplay}</div></div><span style="background:#6366f1;color:#fff;padding:2px 9px;border-radius:7px;font-size:10px;font-weight:700;">ACTIVE</span></div>`
            : `<div style="padding:13px 15px;border:1.5px dashed #cbd5e1;border-radius:11px;color:#94a3b8;font-size:12.5px;text-align:center;">Chưa có key</div>`;

        const keySection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🔑</span>API Keys</h4><p class="ac-section-desc">Đang có <b>${keyCount}</b> key. Live Model List đã gộp vào đây.</p>${keyStatus}<div style="display:flex;gap:8px;margin-top:13px;"><button type="button" class="ac-btn ac-btn-primary" id="ac-manage-keys" style="flex:1;justify-content:center;">🔧 Quản lý keys</button><button type="button" class="ac-btn ac-btn-secondary" id="ac-open-free-models-keys" style="flex:1;justify-content:center;background:#ecfdf5;color:#059669;border-color:#a7f3d0;">🆓 Live Model List</button></div></div>`;
        const profileSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📚</span>Profiles nhanh <span style="font-size:11px;color:#94a3b8;font-weight:500;margin-left:auto;">${Object.keys(PROFILES).length} presets</span></h4><p class="ac-section-desc">Bấm để áp dụng. Các preset 🎭 có variation features.</p><div class="ac-profile-grid">${Object.entries(PROFILES).map(([key, p]) => `<button type="button" class="ac-profile-btn" data-profile="${key}"><span class="ac-profile-emoji">${p.emoji}</span><span class="ac-profile-info"><span class="ac-profile-name">${p.label}</span><span class="ac-profile-desc">${p.desc}</span></span></button>`).join('')}</div></div>`;
        const customPromptSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📝</span>Prompt riêng</h4><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">${Object.entries(PROMPT_PRESETS).map(([key, p]) => `<button type="button" class="ac-btn ac-btn-secondary" data-prompt-preset="${key}" style="height:36px;padding:0 14px;font-size:12.5px;gap:8px;"><span>${p.emoji}</span><span>${p.label}</span></button>`).join('')}</div><textarea id="ac-custom-prompt" class="ac-textarea" rows="4" placeholder="Để trống = tắt." spellcheck="false"></textarea></div>`;
        const keybindSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">⌨️</span>Phím tắt</h4><div class="ac-keybind-row"><div class="ac-keybind-field"><label class="ac-keybind-label">Ẩn/hiện nút (ẩn = tắt mọi popup)</label><div class="ac-keybind-input" id="ac-kb-hide" tabindex="0"></div></div><button class="ac-btn ac-btn-secondary ac-keybind-clear" data-target="ac-kb-hide">Xóa</button></div><div class="ac-keybind-row"><div class="ac-keybind-field"><label class="ac-keybind-label">Bật/tắt Auto Chat</label><div class="ac-keybind-input" id="ac-kb-auto" tabindex="0"></div></div><button class="ac-btn ac-btn-secondary ac-keybind-clear" data-target="ac-kb-auto">Xóa</button></div></div>`;

        const statusSection = `
            <div class="ac-section">
                <h4 class="ac-section-title"><span class="ac-section-emoji">🩺</span>Trạng thái tổng thể</h4>
                <p class="ac-section-desc">Kiểm tra Edunext còn khớp với script không. Chạy tự động khi Auto Chat bật.</p>
                <div id="ac-status-panel"></div>
                <button type="button" class="ac-btn ac-btn-secondary" id="ac-status-run" style="margin-top:12px;width:100%;justify-content:center;height:36px;font-size:12.5px;">🔍 Chạy kiểm tra ngay</button>
            </div>
        `;

        const selectorsSection = `
            <div class="ac-section">
                <h4 class="ac-section-title"><span class="ac-section-emoji">🩹</span>Self-Healing Selectors</h4>
                <p class="ac-section-desc">Tự động dùng resolver dự phòng khi FPT đổi cấu trúc DOM. Mặc định TẮT — bật khi cần.</p>
                ${inlineRadio('selfHealingEnabled', ON_OFF_PRESETS, SETTINGS.selfHealingEnabled || 'off', '🩹 <b>Bật self-healing</b> — tự chuyển sang fallback khi selector chính fail.', '#10b981')}
            </div>
            <div class="ac-section">
                <h4 class="ac-section-title"><span class="ac-section-emoji">📡</span>DOM Health Monitor</h4>
                <p class="ac-section-desc">Kiểm tra định kỳ khi Auto Chat BẬT. Mặc định TẮT.</p>
                ${inlineRadio('domHealthEnabled', ON_OFF_PRESETS, SETTINGS.domHealthEnabled || 'off', '📡 <b>Bật health check</b> — chỉ chạy khi Auto Chat ON.', '#6366f1')}
                <div style="margin-top:12px;">
                    <label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Khoảng thời gian (giây)</label>
                    <select id="ac-dom-health-interval" class="ac-input">
                        ${[10, 30, 60, 120, 300].map(n => `<option value="${n}" ${String(SETTINGS.domHealthInterval || 30) === String(n) ? 'selected' : ''}>${n}s</option>`).join('')}
                    </select>
                </div>
                <div style="margin-top:12px;">
                    <label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Mức độ log</label>
                    <select id="ac-selector-log-level" class="ac-input">
                        <option value="off"   ${SETTINGS.selectorLogLevel === 'off'   ? 'selected' : ''}>Off — không log gì</option>
                        <option value="error" ${SETTINGS.selectorLogLevel === 'error' ? 'selected' : ''}>Error only</option>
                        <option value="warn"  ${(SETTINGS.selectorLogLevel || 'warn') === 'warn' ? 'selected' : ''}>Warning (khuyến nghị)</option>
                        <option value="info"  ${SETTINGS.selectorLogLevel === 'info'  ? 'selected' : ''}>Info — verbose</option>
                    </select>
                </div>
            </div>
            <div class="ac-section">
                <h4 class="ac-section-title"><span class="ac-section-emoji">📊</span>Trạng thái selector</h4>
                <p class="ac-section-desc">Chỉ hoạt động khi Self-Healing BẬT.</p>
                <div id="ac-selector-status"></div>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <button type="button" class="ac-btn ac-btn-secondary" id="ac-selector-refresh" style="flex:1;justify-content:center;height:34px;font-size:12px;">🔄 Kiểm tra ngay</button>
                    <button type="button" class="ac-btn ac-btn-danger" id="ac-selector-reset" style="flex:1;justify-content:center;height:34px;font-size:12px;">🗑️ Reset cache</button>
                </div>
            </div>
        `;

        const ensembleSection = `
            <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🗳️</span>Ensemble voting</h4>
                <p class="ac-section-desc">Hỏi AI nhiều lần song song và bầu đáp án.</p>
                ${inlineRadio('ensembleEnabled', ON_OFF_PRESETS, SETTINGS.ensembleEnabled || 'off', '', '#6366f1')}
                ${makeGroup('ensembleMode', ENSEMBLE_MODE_PRESETS, SETTINGS.ensembleMode || 'single', '🎯', 'Chế độ ensemble', '<b>Cùng model</b>: 1 model × N. <b>Đa model</b>: N model khác nhau (cross-validate).', '#8b5cf6')}
                ${inlineRadio('routerEnabled', ON_OFF_PRESETS, SETTINGS.routerEnabled || 'off', '🎯 <b>Model Router</b> — tự chọn model theo dạng câu hỏi.', '#10b981')}
                <div style="margin-top:12px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Số lần gọi song song</label><select id="ac-ensemble-count" class="ac-input">${Object.entries(ENSEMBLE_COUNT_PRESETS).map(([k, p]) => `<option value="${k}" ${(SETTINGS.ensembleCount || 'three') === k ? 'selected' : ''}>${p.label} — ${p.desc}</option>`).join('')}</select></div>
                <div style="margin-top:13px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Chiến lược</label>${Object.entries(ENSEMBLE_STRATEGY_PRESETS).map(([k, p]) => `<label class="ac-option" style="--ac-opt-accent:#6366f1;--ac-opt-bg:#eef2ff;"><input type="radio" name="ensembleStrategy" value="${k}" ${(SETTINGS.ensembleStrategy || 'majority') === k ? 'checked' : ''}><span class="ac-opt-label">${p.label}</span><span class="ac-opt-desc">${p.desc}</span></label>`).join('')}</div>
            </div>
        `;
        const imageSection = `
            <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🖼️</span>Image Support</h4>
                <p class="ac-section-desc">Tự động phát hiện và gửi ảnh cho AI vision.</p>
                ${inlineRadio('imageSupport', ON_OFF_PRESETS, SETTINGS.imageSupport || 'on', '🖼️ <b>Bật đọc ảnh</b>', '#c026d3')}
                ${inlineRadio('imageAutoRoute', ON_OFF_PRESETS, SETTINGS.imageAutoRoute || 'on', '🎯 <b>Auto-route sang vision model</b>.', '#10b981')}
            </div>
        `;
        const activitySection = `
            <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📺</span>Live Activity Panel</h4>
                <p class="ac-section-desc">Panel hiển thị real-time mọi bước. Hotkey: <code>Ctrl+Shift+A</code>.</p>
                ${inlineRadio('activityPanelOpen', ON_OFF_PRESETS, SETTINGS.activityPanelOpen || 'off', '📺 <b>Tự mở khi load</b>.', '#6366f1')}
                ${inlineRadio('activityToasts', ON_OFF_PRESETS, SETTINGS.activityToasts || 'off', '🔔 <b>Mirror ra toast</b>.', '#f59e0b')}
            </div>
        `;
        const freeModelsSection = `
            <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🆓</span>Live Model Tracker</h4>
                <p class="ac-section-desc">Fetch tự động danh sách model LIVE cho mỗi provider.</p>
                ${inlineRadio('freeModelsAutoRefresh', ON_OFF_PRESETS, SETTINGS.freeModelsAutoRefresh || 'on', '🔄 <b>Tự động fetch khi load</b>.', '#10b981')}
                <button type="button" class="ac-btn ac-btn-primary" id="ac-open-free-models" style="margin-top:12px;width:100%;justify-content:center;">🆓 Mở Live Model List</button>
            </div>
        `;
        const cacheSection = `
            <div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">💾</span>Smart Answer Cache</h4>
                <p class="ac-section-desc">Cache đáp án cũ.</p>
                ${inlineRadio('cacheEnabled', ON_OFF_PRESETS, SETTINGS.cacheEnabled || 'on', '', '#f59e0b')}
                ${inlineRadio('cacheFuzzy', ON_OFF_PRESETS, SETTINGS.cacheFuzzy || 'on', '🔍 <b>Fuzzy matching</b>.', '#8b5cf6')}
                ${inlineRadio('cacheShowHit', ON_OFF_PRESETS, SETTINGS.cacheShowHit || 'on', '📢 <b>Toast khi cache hit</b>.', '#10b981')}
                <div style="margin-top:12px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">TTL</label><select id="ac-cache-ttl" class="ac-input">${Object.entries(CACHE_TTL_PRESETS).map(([k, p]) => `<option value="${k}" ${String(getCacheTTL()) === String(k) ? 'selected' : ''}>${p.label} — ${p.desc}</option>`).join('')}</select></div>
                <div style="margin-top:12px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Max entries</label><select id="ac-cache-max" class="ac-input">${Object.entries(CACHE_MAX_PRESETS).map(([k, p]) => `<option value="${k}" ${String(getCacheMax()) === String(k) ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
                <div style="margin-top:12px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Min confidence</label><select id="ac-cache-minconf" class="ac-input">${[0,3,5,6,7,8,9].map(n => `<option value="${n}" ${String(getCacheMinConfidence()) === String(n) ? 'selected' : ''}>${n === 0 ? '0 — Tất cả' : n + '/10+'}</option>`).join('')}</select></div>
                <div class="ac-info" style="margin-top:12px;font-size:11.5px;"><span>📦</span><span>Có <b>${cStats.valid}</b> entries · <b>${cStats.totalHits}</b> hits</span></div>
                <button type="button" class="ac-btn ac-btn-primary" id="ac-open-cache-manager" style="margin-top:12px;width:100%;justify-content:center;">💾 Cache Manager</button>
            </div>
        `;

        const timingSection =
            makeGroup('autoSubmit', AUTO_SUBMIT_PRESETS, SETTINGS.autoSubmit || 'on', '🚀', 'Chế độ nộp bài', 'Tự động gửi hoặc chỉ điền nháp vào ô.', '#059669') +
            makeGroup('speed', SPEED_PRESETS, SETTINGS.speed, '⏱️', 'Tốc độ', 'Từ 🐌 đến ⚡⚡.', '#6366f1') +
            makeGroup('waitBeforeSend', WAIT_BEFORE_SEND_PRESETS, SETTINGS.waitBeforeSend, '⏸️', 'Chờ trước gửi', '', '#0891b2') +
            makeGroup('autoType', AUTO_TYPE_PRESETS, SETTINGS.autoType, '⌨️', 'Auto type', '', '#7c3aed') +
            makeGroup('readyAutoEnter', READY_AUTO_ENTER_PRESETS, SETTINGS.readyAutoEnter || 'normal', '🚀', 'Auto Enter khi Sẵn sàng', '', '#10b981') +
            `
            <div class="ac-section">
                <h4 class="ac-section-title"><span class="ac-section-emoji">🎭</span>Behavioral Fingerprint</h4>
                <p class="ac-section-desc">Sinh hệ số random cho mỗi session — tốc độ gõ và pause khác nhau giữa các lần, nhưng ổn định trong 1 session.</p>
                ${inlineRadio('behavioralFingerprint', BEHAVIORAL_FINGERPRINT_PRESETS, SETTINGS.behavioralFingerprint || 'off', '🎭 Khi bật, mỗi session có 1 seed riêng cho typing + pause.', '#ec4899')}
            </div>
            <div class="ac-section">
                <h4 class="ac-section-title"><span class="ac-section-emoji">🎲</span>Response Time Jitter</h4>
                <p class="ac-section-desc">Thêm biến thiên ngẫu nhiên cho mọi delay — không lần nào trùng lần nào.</p>
                ${inlineRadio('responseTimeJitter', RESPONSE_JITTER_PRESETS, SETTINGS.responseTimeJitter || 'off', '🎲 Áp dụng cho: typing delay, wait before send, TYPING_DELAY.', '#f59e0b')}
            </div>
            `;

        const confidenceSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">📊</span>Confidence scoring</h4><p class="ac-section-desc">AI tự chấm độ tin cậy (1-10).</p>${inlineRadio('confidenceEnabled', ON_OFF_PRESETS, SETTINGS.confidenceEnabled || 'off', '', '#6366f1')}<div style="margin-top:12px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Ngưỡng</label><select id="ac-confidence-threshold" class="ac-input">${[4,5,6,7,8,9].map(n => `<option value="${n}" ${(SETTINGS.confidenceThreshold||7) == n ? 'selected' : ''}>${n}/10</option>`).join('')}</select></div><div style="margin-top:13px;"><label style="display:block;font-size:12px;font-weight:600;margin-bottom:7px;color:#0f172a;">Hành động</label>${Object.entries(CONFIDENCE_ACTION_PRESETS).map(([key, p]) => `<label class="ac-option" style="--ac-opt-accent:#6366f1;--ac-opt-bg:#eef2ff;"><input type="radio" name="confidenceAction" value="${key}" ${(SETTINGS.confidenceAction||'recheck') === key ? 'checked' : ''}><span class="ac-opt-label">${p.label}</span><span class="ac-opt-desc">${p.desc}</span></label>`).join('')}</div></div>`;

        const subjectSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🎓</span>Nhận diện môn học</h4><p class="ac-section-desc">Tự nhận diện môn (Văn/Anh/Kinh tế-Pháp luật/Toán/Lý/Hoá) và điều chỉnh prompt + ký hiệu cho phù hợp. Bật khuyến nghị khi làm đề tổng hợp.</p>${inlineRadio('subjectDetection', ON_OFF_PRESETS, SETTINGS.subjectDetection || 'off', '🎓 <b>Bật nhận diện môn</b> — AI sẽ trả lời đúng văn phong từng môn.', '#8b5cf6')}</div>`;

        const aiSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🎯</span>Model đang dùng</h4><div class="ac-info"><span>${provider?.emoji || '🔑'}</span><span style="flex:1;"><b>${active?.name || 'Chưa có key'}</b>${provider?.supportsVision ? ' <span style="color:#c026d3;">👁️</span>' : ''}<br>${modelDisplay}</span></div></div>` +
            makeGroup('smartness', SMARTNESS_PRESETS, SETTINGS.smartness, '⚙️', 'Shape profile', '', '#6366f1') +
            makeGroup('responseLength', RESPONSE_LENGTH_PRESETS, SETTINGS.responseLength, '📏', 'Độ dài', `Max tokens: <b>${computeMaxTokens()}</b>`, '#db2777') +
            ensembleSection +
            makeGroup('recheckMode', RECHECK_PRESETS, SETTINGS.recheckMode, '🔍', 'Recheck', '', '#ea580c') +
            makeGroup('failRetryMode', FAIL_RETRY_PRESETS, SETTINGS.failRetryMode, '🔁', 'Fail retry', '', '#f59e0b') +
            confidenceSection + subjectSection;

        const styleSection =
            makeGroup('forceVietnamese', FORCE_VIETNAMESE_PRESETS, SETTINGS.forceVietnamese || 'on', '🇻🇳', 'Ngôn ngữ', 'Khi subject = Tiếng Anh, script sẽ ưu tiên output tiếng Anh cho câu dịch/viết.', '#dc2626') +
            makeGroup('vietnameseStrictness', VIETNAMESE_STRICTNESS_PRESETS, SETTINGS.vietnameseStrictness || 'normal', '🔍', 'Kiểm tra tiếng Anh', 'Không áp dụng khi subject = Tiếng Anh.', '#10b981') +
            makeGroup('notation', NOTATION_PRESETS, SETTINGS.notation, '🔢', 'Ký hiệu toán', 'Không áp dụng cho Văn/Anh/Kinh tế-Pháp luật.', '#059669') +
            makeGroup('physicsNotation', PHYSICS_NOTATION_PRESETS, SETTINGS.physicsNotation, '⚛️', 'Ký hiệu vật lý', '', '#7c3aed') +
            makeGroup('chemNotation', CHEM_NOTATION_PRESETS, SETTINGS.chemNotation, '⚛️', 'Ký hiệu hoá học', '', '#0891b2') +
            makeGroup('slangRate', SLANG_PRESETS, SETTINGS.slangRate, '🗣️', 'Tiếng lóng', '', '#c026d3') +
            makeGroup('mistakeRate', MISTAKE_PRESETS, SETTINGS.mistakeRate, '🎭', 'Cố tình sai', '', '#dc2626') +
            makeGroup('diacriticRate', DIACRITIC_PRESETS, SETTINGS.diacriticRate, '⌨️', 'Kiểu dấu', '', '#d97706') +
            makeGroup('filterIds', FILTER_ID_PRESETS, SETTINGS.filterIds, '🧹', 'Lọc rác', '', '#0891b2') +
            makeGroup('stripReplyPrefix', STRIP_PREFIX_PRESETS, SETTINGS.stripReplyPrefix, '✂️', 'Bỏ prefix', '', '#0891b2');

        const smartSection = `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🧠</span>Hành vi</h4>${inlineRadio('questionTypeDetection', ON_OFF_PRESETS, SETTINGS.questionTypeDetection, '🎯 Nhận diện loại câu hỏi.', '#8b5cf6')}${inlineRadio('humanTouch', ON_OFF_PRESETS, SETTINGS.humanTouch, '⌨️ Gõ có typo.', '#ec4899')}${inlineRadio('fatigueCurve', ON_OFF_PRESETS, SETTINGS.fatigueCurve, '😮‍💨 Mệt mỏi.', '#f97316')}${inlineRadio('duplicateGuard', ON_OFF_PRESETS, SETTINGS.duplicateGuard, '🛡️ Chống nộp trùng.', '#06b6d4')}${inlineRadio('toasts', ON_OFF_PRESETS, SETTINGS.toasts, '🍞 Toast.', '#10b981')}</div>` +
            makeGroup('autoDisableAfterFailures', AUTO_DISABLE_PRESETS, SETTINGS.autoDisableAfterFailures, '🛑', 'Tự dừng khi sai nhiều', '', '#dc2626') +
            makeGroup('justOneMore', JUST_ONE_MORE_PRESETS, SETTINGS.justOneMore, '🎁', 'Chờ bonus', '', '#059669') +
            `<div class="ac-section"><h4 class="ac-section-title"><span class="ac-section-emoji">🔔</span>Thông báo lỗi</h4>${Object.entries(FAILURE_NOTIF_PRESETS).map(([key, p]) => `<label class="ac-option" style="--ac-opt-accent:#dc2626;--ac-opt-bg:#fef2f2;"><input type="radio" name="failureNotification" value="${key}" ${SETTINGS.failureNotification === key ? 'checked' : ''}><span class="ac-opt-label">${p.label}</span><span class="ac-opt-desc">${p.desc}</span></label>`).join('')}</div>`;

        const TABS = [
            { id: 'quick',   emoji: '🎯', label: 'Quick',   content: profileSection + customPromptSection },
            { id: 'timing',  emoji: '⏱️', label: 'Timing',  content: timingSection },
            { id: 'ai',      emoji: '🤖', label: 'AI',      content: aiSection },
            { id: 'vision',  emoji: '🖼️', label: 'Vision',  content: imageSection },
            { id: 'activity',emoji: '📺', label: 'Activity',content: activitySection },
            { id: 'free',    emoji: '🆓', label: 'Free',    content: freeModelsSection },
            { id: 'cache',   emoji: '💾', label: 'Cache',   content: cacheSection },
            { id: 'style',   emoji: '🎭', label: 'Style',   content: styleSection },
            { id: 'smart',   emoji: '🧠', label: 'Smart',   content: smartSection },
            { id: 'selectors', emoji: '🩹', label: 'Selectors', content: statusSection + selectorsSection },
            { id: 'keys',    emoji: '🔑', label: 'Keys',    content: keySection + keybindSection }
        ];
        if (!TABS.find(t => t.id === activeSettingsTab)) activeSettingsTab = 'quick';
        const tabBar = `<div class="ac-tabs-wrapper" id="ac-tabs-wrapper">
            <button type="button" class="ac-tabs-arrow ac-tabs-arrow-left" id="ac-tabs-left" aria-label="Cuộn trái">‹</button>
            <div class="ac-tabs" id="ac-tabs-scroll">
                ${TABS.map(t => `<button type="button" class="ac-tab ${t.id === activeSettingsTab ? 'ac-tab-active' : ''}" data-tab="${t.id}"><span>${t.emoji}</span><span>${t.label}</span></button>`).join('')}
            </div>
            <button type="button" class="ac-tabs-arrow ac-tabs-arrow-right" id="ac-tabs-right" aria-label="Cuộn phải">›</button>
        </div>`;
        const tabPanels = TABS.map(t => `<div class="ac-tab-panel ${t.id === activeSettingsTab ? 'ac-tab-panel-active' : ''}" data-tab="${t.id}">${t.content}</div>`).join('');

        box.innerHTML = `<div class="ac-dialog-header"><div><h3 class="ac-dialog-title">⚙️ Cài đặt</h3><p class="ac-dialog-subtitle">Chọn danh mục bên dưới để cấu hình · <b style="color:#6366f1;">${escapeHtml(CREDIT_TEXT)}</b></p></div><button class="ac-dialog-close" id="settings-close-x">×</button></div>${tabBar}<div class="ac-dialog-body">${tabPanels}</div><div class="ac-dialog-footer"><div id="settings-status" class="ac-status" style="margin:0 auto 0 0;align-self:center;"></div><button class="ac-btn ac-btn-secondary" id="settings-cancel">Hủy</button><button class="ac-btn ac-btn-primary" id="settings-save">Lưu</button></div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const tabsWrapper = document.getElementById('ac-tabs-wrapper');
        const tabsScroll = document.getElementById('ac-tabs-scroll');
        const tabsLeft = document.getElementById('ac-tabs-left');
        const tabsRight = document.getElementById('ac-tabs-right');
        function updateScrollArrows() {
            if (!tabsScroll || !tabsWrapper) return;
            const canL = tabsScroll.scrollLeft > 4;
            const canR = tabsScroll.scrollLeft + tabsScroll.clientWidth < tabsScroll.scrollWidth - 4;
            tabsWrapper.classList.toggle('ac-can-scroll-left', canL);
            tabsWrapper.classList.toggle('ac-can-scroll-right', canR);
        }
        tabsScroll.addEventListener('scroll', updateScrollArrows, { passive: true });
        window.addEventListener('resize', updateScrollArrows);
        tabsLeft.onclick = (e) => { e.stopPropagation(); tabsScroll.scrollBy({ left: -220, behavior: 'smooth' }); };
        tabsRight.onclick = (e) => { e.stopPropagation(); tabsScroll.scrollBy({ left: 220, behavior: 'smooth' }); };
        tabsScroll.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                tabsScroll.scrollLeft += e.deltaY;
            }
        }, { passive: false });
        setTimeout(updateScrollArrows, 60);
        setTimeout(() => {
            const at = tabsScroll.querySelector('.ac-tab-active');
            if (at) at.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            updateScrollArrows();
        }, 80);

        const close = () => { window.removeEventListener('resize', updateScrollArrows); overlay.remove(); };
        document.getElementById('settings-cancel').onclick = close;
        document.getElementById('settings-close-x').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        box.querySelectorAll('.ac-tab').forEach(tab => tab.addEventListener('click', () => {
            const t = tab.dataset.tab;
            activeSettingsTab = t;
            box.querySelectorAll('.ac-tab').forEach(x => x.classList.toggle('ac-tab-active', x.dataset.tab === t));
            box.querySelectorAll('.ac-tab-panel').forEach(p => p.classList.toggle('ac-tab-panel-active', p.dataset.tab === t));
            const b = box.querySelector('.ac-dialog-body'); if (b) b.scrollTop = 0;
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            setTimeout(updateScrollArrows, 400);
        }));
        const mkBtn = document.getElementById('ac-manage-keys');
        if (mkBtn) mkBtn.onclick = () => { close(); showKeyManagerDialog(); };
        const mkFree = document.getElementById('ac-open-free-models-keys');
        if (mkFree) mkFree.onclick = () => { close(); showFreeModelsDialog(); };
        const ocb = document.getElementById('ac-open-cache-manager');
        if (ocb) ocb.onclick = () => { close(); showCacheManagerDialog(); };
        const ofm = document.getElementById('ac-open-free-models');
        if (ofm) ofm.onclick = () => { close(); showFreeModelsDialog(); };

        const renderSelectorStatus = () => {
            const el = document.getElementById('ac-selector-status');
            if (!el) return;
            const report = getSelectorReport();
            if (report.every(r => r.stats.primaryHits === 0 && r.stats.fallbackHits === 0 && r.stats.misses === 0)) {
                el.innerHTML = `<div style="padding:20px 16px;text-align:center;color:#94a3b8;font-size:12px;">Chưa có dữ liệu. Self-Healing mặc định TẮT.</div>`;
                return;
            }
            el.innerHTML = report.map(r => {
                const activeLabel = r.active !== null ? `Resolver #${r.active + 1}` : '❌ Không tìm thấy';
                const activeColor = r.active === 0 ? '#059669' : (r.active !== null ? '#f59e0b' : '#dc2626');
                return `<div style="padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-weight:700;font-size:12.5px;color:#0f172a;">${r.label}</span>
                        <span style="margin-left:auto;font-size:11px;font-weight:700;color:${activeColor};">${activeLabel}</span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#64748b;">
                        <span>✅ Primary: <b>${r.stats.primaryHits}</b></span>
                        <span>🔁 Fallback: <b>${r.stats.fallbackHits}</b></span>
                        <span>❌ Miss: <b style="color:${r.stats.misses > 0 ? '#dc2626' : '#64748b'};">${r.stats.misses}</b></span>
                        <span>🔀 Changes: <b>${r.stats.changes.length}</b></span>
                    </div>
                </div>`;
            }).join('');
        };
        renderSelectorStatus();

        const renderStatusPanel = () => {
            const el = document.getElementById('ac-status-panel');
            if (!el) return;
            const r = runHealthCheck();
            const rows = r.checks.map(c => {
                const icon = c.ok ? '✅' : (c.critical ? '❌' : '⚠️');
                const color = c.ok ? '#059669' : (c.critical ? '#dc2626' : '#f59e0b');
                const bg = c.ok ? '#f8fafc' : (c.critical ? '#fef2f2' : '#fffbeb');
                const border = c.ok ? '#e2e8f0' : (c.critical ? '#fecaca' : '#fde68a');
                return `<div style="padding:9px 12px;border:1.5px solid ${border};border-radius:9px;background:${bg};margin-bottom:6px;display:flex;align-items:flex-start;gap:9px;">
                    <span style="font-size:14px;flex-shrink:0;line-height:1.4;">${icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12.5px;font-weight:600;color:#0f172a;margin-bottom:2px;">${c.name}</div>
                        <div style="font-size:11px;color:#64748b;font-family:ui-monospace,monospace;word-break:break-word;">${escapeHtml(c.detail)}</div>
                        ${!c.ok && c.hint ? `<div style="font-size:11px;color:${color};margin-top:4px;font-style:italic;">💡 ${escapeHtml(c.hint)}</div>` : ''}
                    </div>
                    <span style="font-size:10px;font-weight:700;color:${color};flex-shrink:0;">${c.critical ? 'CRIT' : 'INFO'}</span>
                </div>`;
            }).join('');
            const age = lastHealthReport ? Math.round((Date.now() - lastHealthReport.timestamp) / 1000) : 0;
            const ageStr = age < 60 ? `${age}s trước` : `${Math.round(age/60)}m trước`;
            el.innerHTML = `
                <div style="padding:14px 16px;border:1.5px solid ${r.critOk ? '#a7f3d0' : '#fecaca'};border-radius:11px;background:${r.critOk ? '#ecfdf5' : '#fef2f2'};margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                        <div style="font-size:32px;font-weight:700;color:${scoreColor(r.score)};font-family:ui-monospace,monospace;line-height:1;">${r.score}%</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:12.5px;font-weight:700;color:#0f172a;margin-bottom:2px;">${scoreLabel(r.score)}</div>
                            <div style="font-size:11px;color:#64748b;">${r.okCount}/${r.total} kiểm tra OK · cập nhật ${ageStr}</div>
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.05em;">Auto Chat</div>
                            <div style="font-size:12px;font-weight:700;color:${r.running ? '#059669' : '#94a3b8'};">${r.running ? '● ON' : '○ OFF'}</div>
                        </div>
                    </div>
                    <div style="height:6px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;">
                        <div style="height:100%;width:${r.score}%;background:${scoreColor(r.score)};transition:width 0.3s ease;"></div>
                    </div>
                </div>
                <div>${rows}</div>
            `;
        };
        renderStatusPanel();

        const statusRunBtn = document.getElementById('ac-status-run');
        if (statusRunBtn) statusRunBtn.onclick = () => { showHealthDialog(); };

        const srf = document.getElementById('ac-selector-refresh');
        if (srf) srf.onclick = () => {
            resetSelectorCache();
            ['textarea', 'submitBtn'].forEach(k => resolveSelector(k));
            resolveSelector('messageStack', { multi: true });
            renderSelectorStatus();
            renderStatusPanel();
            showToast('Đã kiểm tra selectors', 'success', 1500);
        };
        const srs = document.getElementById('ac-selector-reset');
        if (srs) srs.onclick = () => {
            if (!confirm('Reset selector cache?')) return;
            resetSelectorCache();
            renderSelectorStatus();
            showToast('Đã reset selector cache', 'info', 1500);
        };

        const cpi = document.getElementById('ac-custom-prompt');
        const rp = () => { if (!cpi) return; cpi.style.height = 'auto'; cpi.style.height = Math.min(360, cpi.scrollHeight) + 'px'; };
        if (cpi) { cpi.value = SETTINGS.customPrompt || ''; cpi.addEventListener('input', rp); setTimeout(rp, 0); }
        box.querySelectorAll('[data-prompt-preset]').forEach(btn => btn.addEventListener('click', e => {
            e.preventDefault();
            const k = btn.dataset.promptPreset; const p = PROMPT_PRESETS[k]; if (!p || !cpi) return;
            if (k === 'blank') { if (cpi.value.trim() && !confirm('Xóa prompt?')) return; cpi.value = ''; }
            else { if (cpi.value.trim() && cpi.value.trim() !== p.text.trim() && !confirm('Ghi đè?')) return; cpi.value = p.text; }
            rp(); showToast(`Đã áp dụng: ${p.label}`, 'success', 2000);
        }));

        const hki = document.getElementById('ac-kb-hide'); const aki = document.getElementById('ac-kb-auto');
        hki.dataset.value = SETTINGS.hideKeybind || ''; aki.dataset.value = SETTINGS.autoChatKeybind || '';
        function setupKb(inputEl) {
            const upd = () => { if (inputEl.classList.contains('ac-capturing')) return; const v = inputEl.dataset.value; inputEl.textContent = v ? formatKeybindDisplay(v) : 'Chưa đặt'; };
            inputEl.addEventListener('click', e => { e.stopPropagation(); if (inputEl.classList.contains('ac-capturing')) return; inputEl.classList.add('ac-capturing'); inputEl.textContent = ''; inputEl.focus(); });
            inputEl.addEventListener('keydown', e => { if (!inputEl.classList.contains('ac-capturing')) return; e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape') { inputEl.classList.remove('ac-capturing'); upd(); return; } if (['Control','Shift','Alt','Meta','CapsLock'].includes(e.key)) return; const kb = eventToKeybind(e); if (!kb) return; inputEl.dataset.value = kb; inputEl.classList.remove('ac-capturing'); upd(); });
            inputEl.addEventListener('blur', () => { if (inputEl.classList.contains('ac-capturing')) { inputEl.classList.remove('ac-capturing'); upd(); } });
            upd();
        }
        setupKb(hki); setupKb(aki);
        box.querySelectorAll('.ac-keybind-clear').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); const i = document.getElementById(btn.dataset.target); if (!i) return; i.classList.remove('ac-capturing'); i.dataset.value = ''; i.textContent = 'Chưa đặt'; }));
        box.querySelectorAll('.ac-profile-btn').forEach(btn => btn.addEventListener('click', () => { const k = btn.dataset.profile; const pr = PROFILES[k]; if (!pr) return; Object.assign(SETTINGS, pr.settings); saveSettings(SETTINGS); showToast(`Đã áp dụng: ${pr.label}`, 'success', 2500); close(); restartInterval(); }));

        document.getElementById('settings-save').onclick = () => {
            const g = n => box.querySelector(`input[name="${n}"]:checked`)?.value;
            const nh = hki.dataset.value || ''; const na = aki.dataset.value || '';
            if (nh && na && nh === na) { document.getElementById('settings-status').style.color = '#dc2626'; document.getElementById('settings-status').textContent = '❌ 2 phím tắt trùng.'; return; }
            SETTINGS.autoSubmit = g('autoSubmit') || 'on';
            SETTINGS.speed = g('speed') || 'normal';
            SETTINGS.smartness = g('smartness') || 'balanced';
            SETTINGS.responseLength = g('responseLength') || 'normal';
            SETTINGS.waitBeforeSend = g('waitBeforeSend') || 'off';
            SETTINGS.autoType = g('autoType') || 'off';
            SETTINGS.readyAutoEnter = g('readyAutoEnter') || 'normal';
            SETTINGS.recheckMode = g('recheckMode') || 'off';
            SETTINGS.failRetryMode = g('failRetryMode') || 'normal';
            SETTINGS.filterIds = g('filterIds') || 'on';
            SETTINGS.stripReplyPrefix = g('stripReplyPrefix') || 'on';
            SETTINGS.forceVietnamese = g('forceVietnamese') || 'on';
            SETTINGS.vietnameseStrictness = g('vietnameseStrictness') || 'normal';
            SETTINGS.cacheEnabled = g('cacheEnabled') || 'on';
            SETTINGS.cacheFuzzy = g('cacheFuzzy') || 'on';
            SETTINGS.cacheShowHit = g('cacheShowHit') || 'on';
            SETTINGS.cacheTTL = parseInt(document.getElementById('ac-cache-ttl')?.value, 10) || 7;
            SETTINGS.cacheMax = parseInt(document.getElementById('ac-cache-max')?.value, 10) || 500;
            SETTINGS.cacheMinConfidence = parseInt(document.getElementById('ac-cache-minconf')?.value, 10) || 6;
            SETTINGS.ensembleMode = g('ensembleMode') || 'single';
            SETTINGS.routerEnabled = g('routerEnabled') || 'off';
            SETTINGS.imageSupport = g('imageSupport') || 'on';
            SETTINGS.imageAutoRoute = g('imageAutoRoute') || 'on';
            SETTINGS.activityPanelOpen = g('activityPanelOpen') || 'off';
            SETTINGS.activityToasts = g('activityToasts') || 'off';
            SETTINGS.freeModelsAutoRefresh = g('freeModelsAutoRefresh') || 'on';
            SETTINGS.slangRate = g('slangRate') || 'off';
            SETTINGS.mistakeRate = g('mistakeRate') || 'off';
            SETTINGS.diacriticRate = g('diacriticRate') || 'off';
            SETTINGS.notation = g('notation') || 'symbols';
            SETTINGS.physicsNotation = g('physicsNotation') || 'symbols';
            SETTINGS.chemNotation = g('chemNotation') || 'symbols';
            SETTINGS.autoDisableAfterFailures = g('autoDisableAfterFailures') || 'off';
            SETTINGS.justOneMore = g('justOneMore') || 'off';
            SETTINGS.questionTypeDetection = g('questionTypeDetection') || 'off';
            SETTINGS.humanTouch = g('humanTouch') || 'off';
            SETTINGS.fatigueCurve = g('fatigueCurve') || 'off';
            SETTINGS.duplicateGuard = g('duplicateGuard') || 'on';
            SETTINGS.toasts = g('toasts') || 'on';
            SETTINGS.failureNotification = g('failureNotification') || 'toast';
            SETTINGS.confidenceEnabled = g('confidenceEnabled') || 'off';
            SETTINGS.confidenceThreshold = parseInt(document.getElementById('ac-confidence-threshold')?.value, 10) || 7;
            SETTINGS.confidenceAction = g('confidenceAction') || 'recheck';
            SETTINGS.ensembleEnabled = g('ensembleEnabled') || 'off';
            SETTINGS.ensembleCount = document.getElementById('ac-ensemble-count')?.value || 'three';
            SETTINGS.ensembleStrategy = g('ensembleStrategy') || 'majority';
            SETTINGS.subjectDetection = g('subjectDetection') || 'off';
            SETTINGS.selfHealingEnabled = g('selfHealingEnabled') || 'off';
            SETTINGS.domHealthEnabled = g('domHealthEnabled') || 'off';
            SETTINGS.domHealthInterval = parseInt(document.getElementById('ac-dom-health-interval')?.value, 10) || 30;
            SETTINGS.selectorLogLevel = document.getElementById('ac-selector-log-level')?.value || 'warn';
            SETTINGS.behavioralFingerprint = g('behavioralFingerprint') || 'off';
            SETTINGS.responseTimeJitter = g('responseTimeJitter') || 'off';
            if (SETTINGS.behavioralFingerprint !== 'on') sessionFingerprint = null;
            SETTINGS.hideKeybind = nh; SETTINGS.autoChatKeybind = na;
            SETTINGS.customPrompt = (cpi?.value || '').trim();
            if ((SETTINGS.failureNotification === 'desktop' || SETTINGS.failureNotification === 'both') && 'Notification' in window && Notification.permission === 'default') {
                requestNotificationPermission().then(gr => { showToast(gr ? 'Đã cấp quyền notif' : 'Chưa cấp quyền', gr ? 'success' : 'warn', 3000); });
            }
            saveSettings(SETTINGS);
            const st = document.getElementById('settings-status'); st.style.color = '#059669'; st.textContent = '✅ Đã lưu';
            showToast('Đã lưu', 'success', 2000);
            toggleActivityPanel(SETTINGS.activityPanelOpen === 'on');
            setTimeout(() => { close(); restartInterval(); startDomHealthMonitor(); console.log('[Auto Chat] Saved'); }, 700);
        };
    }

    // ============================================================
    // ONBOARDING TUTORIAL
    // ============================================================
    function showTutorialDialog(onClose = null) {
        document.getElementById('ac-tutorial-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'ac-tutorial-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '820px';

        let step = 0;
        const TOTAL = 6;

        const step1Body = `
            <div style="text-align:center;padding:8px 0 4px;">
                <div style="font-size:60px;margin-bottom:12px;line-height:1;">👋</div>
                <h2 style="margin:0 0 8px;font-size:21px;color:#0f172a;letter-spacing:-0.02em;font-weight:700;">Chào mừng đến Auto Chat!</h2><div style="margin-bottom:10px;font-size:12px;font-weight:700;color:#4f46e5;">✨ Credit: ${escapeHtml(CREDIT_TEXT)}</div>
                <p style="margin:0 0 22px;font-size:13.5px;color:#64748b;line-height:1.65;">Công cụ tự động trả lời câu hỏi trên FPT EduNext — sử dụng AI (Groq, Google Gemini, OpenAI, Claude...).</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:11px;">
                <div style="padding:15px 13px;border:1.5px solid #e2e8f0;border-radius:12px;background:linear-gradient(180deg,#f8fafc,#fff);text-align:center;">
                    <div style="font-size:26px;margin-bottom:8px;">🤖</div>
                    <div style="font-size:12.5px;font-weight:700;color:#0f172a;margin-bottom:5px;">Tự động trả lời</div>
                    <div style="font-size:11px;color:#64748b;line-height:1.5;">AI đọc câu hỏi và tự động nộp đáp án</div>
                </div>
                <div style="padding:15px 13px;border:1.5px solid #e2e8f0;border-radius:12px;background:linear-gradient(180deg,#f8fafc,#fff);text-align:center;">
                    <div style="font-size:26px;margin-bottom:8px;">🎓</div>
                    <div style="font-size:12.5px;font-weight:700;color:#0f172a;margin-bottom:5px;">Nhận diện môn</div>
                    <div style="font-size:11px;color:#64748b;line-height:1.5;">Tự điều chỉnh prompt theo Văn / Anh / Toán / Lý / Hoá / KT-PL</div>
                </div>
                <div style="padding:15px 13px;border:1.5px solid #e2e8f0;border-radius:12px;background:linear-gradient(180deg,#f8fafc,#fff);text-align:center;">
                    <div style="font-size:26px;margin-bottom:8px;">💾</div>
                    <div style="font-size:12.5px;font-weight:700;color:#0f172a;margin-bottom:5px;">Cache đáp án</div>
                    <div style="font-size:11px;color:#64748b;line-height:1.5;">Câu trùng lặp trả lời tức thì, tiết kiệm token</div>
                </div>
            </div>
            <div class="ac-info" style="margin-top:20px;background:#eef2ff;border-color:#c7d2fe;">
                <span style="font-size:15px;">💡</span>
                <span style="color:#3730a3;"><b>Để bắt đầu, bạn cần 1 API key.</b> Hoàn toàn <b>miễn phí</b> với Groq hoặc Google Gemini — sẽ hướng dẫn chi tiết ở bước tiếp theo.</span>
            </div>
        `;

        const step2Body = `
            <p style="margin:0 0 15px;font-size:13.5px;color:#334155;line-height:1.65;">Bạn cần <b>1 API key</b> để tool gọi AI. Nên chọn provider <b>miễn phí</b> để bắt đầu:</p>

            <div style="padding:14px 16px;border:2px solid #10b981;border-radius:12px;background:#ecfdf5;margin-bottom:11px;">
                <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;">
                    <span style="font-size:20px;">⚡</span>
                    <b style="font-size:13.5px;color:#065f46;flex:1;">Groq — Khuyến nghị (miễn phí, nhanh nhất)</b>
                    <span style="background:#10b981;color:#fff;padding:2px 9px;border-radius:6px;font-size:10px;font-weight:700;">FREE</span>
                </div>
                <ol style="margin:0;padding-left:20px;font-size:12.5px;color:#065f46;line-height:1.85;">
                    <li>Mở <a href="https://console.groq.com/keys" target="_blank" style="color:#059669;font-weight:700;text-decoration:underline;">console.groq.com/keys</a></li>
                    <li>Đăng ký / đăng nhập (Google, GitHub hoặc email)</li>
                    <li>Bấm <b>"Create API Key"</b>, đặt tên bất kỳ</li>
                    <li>Copy key (bắt đầu bằng <code style="background:#fff;padding:1px 6px;border-radius:4px;">gsk_...</code>) — <b>lưu lại vì chỉ hiện 1 lần</b></li>
                </ol>
            </div>

            <div style="padding:12px 15px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fff;margin-bottom:9px;">
                <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;flex-wrap:wrap;">
                    <span style="font-size:18px;">✨</span>
                    <b style="font-size:12.5px;color:#0f172a;">Google Gemini</b>
                    <span style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">FREE</span>
                    <span style="background:#fae8ff;color:#c026d3;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">👁️ vision</span>
                </div>
                <div style="font-size:12px;color:#64748b;line-height:1.65;">Lấy tại <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#6366f1;font-weight:600;text-decoration:underline;">aistudio.google.com/app/apikey</a> — key bắt đầu <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;">AIza...</code>. Hỗ trợ đọc ảnh.</div>
            </div>

            <div style="padding:12px 15px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fff;margin-bottom:9px;">
                <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;flex-wrap:wrap;">
                    <span style="font-size:18px;">🌐</span>
                    <b style="font-size:12.5px;color:#0f172a;">OpenRouter</b>
                    <span style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">FREE tier</span>
                </div>
                <div style="font-size:12px;color:#64748b;line-height:1.65;">Lấy tại <a href="https://openrouter.ai/keys" target="_blank" style="color:#6366f1;font-weight:600;text-decoration:underline;">openrouter.ai/keys</a> — key bắt đầu <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;">sk-or-...</code>. Nhiều model có tag <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;">:free</code>.</div>
            </div>

            <div style="padding:12px 15px;border:1.5px solid #e2e8f0;border-radius:11px;background:#f8fafc;margin-bottom:0;">
                <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;">
                    <span style="font-size:18px;">💵</span>
                    <b style="font-size:12.5px;color:#0f172a;">OpenAI / Claude / DeepSeek</b>
                    <span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">PAID</span>
                </div>
                <div style="font-size:12px;color:#64748b;line-height:1.65;">Cần nạp credit ($5+). Chất lượng cao hơn nhưng không cần thiết cho người mới.</div>
            </div>
        `;

        const step3Body = `
            <p style="margin:0 0 14px;font-size:13.5px;color:#334155;line-height:1.65;">Sau khi có key, thêm vào tool theo các bước sau:</p>
            <ol style="margin:0;padding-left:22px;font-size:13px;color:#334155;line-height:1.9;">
                <li>Bấm nút <b style="background:#eef2ff;color:#6366f1;padding:2px 8px;border-radius:6px;font-family:ui-monospace,monospace;font-size:11.5px;">🔑 Keys</b> trên thanh công cụ</li>
                <li>Bấm <b>"+ Thêm key mới"</b></li>
                <li>Chọn <b>Nhà cung cấp</b> (Groq / Gemini / ...)</li>
                <li>Dán key vào ô <b>API Key</b> (form tự kiểm tra đúng định dạng)</li>
                <li>Chọn <b>Model</b> — form gợi ý sẵn danh sách, cứ dùng model đầu tiên</li>
                <li>Đặt <b>tên gợi nhớ</b> (tùy chọn, ví dụ "Groq cá nhân")</li>
                <li>Bấm <b>🔍 Test</b> để kiểm tra — nếu hiện ✅ OK là key hoạt động</li>
                <li>Bấm <b>Lưu</b> — key đã sẵn sàng!</li>
            </ol>
            <div class="ac-info" style="margin-top:16px;background:#ecfdf5;border-color:#a7f3d0;">
                <span style="font-size:15px;">✅</span>
                <span style="color:#065f46;">Nếu bấm Test báo lỗi, kiểm tra lại key đã copy đủ chưa (không có khoảng trắng dư). Có thể thêm nhiều key và chuyển đổi qua lại trong <b>🔑 Keys</b>.</span>
            </div>
        `;

        const step4Body = `
            <p style="margin:0 0 14px;font-size:13.5px;color:#334155;line-height:1.65;">Thanh công cụ nằm ở <b>góc trên bên phải</b> màn hình. Từng nút có chức năng riêng:</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;font-size:12.5px;">
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">📝 Draft Assistant: OFF</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Khi bật, công cụ theo dõi bài và điền bản nháp vào ô nhập. Bạn tự xem lại và gửi.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🔑 Keys</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Quản lý API key + xem danh sách model LIVE từ mọi provider.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">⚙️ Cài đặt</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Cấu hình toàn bộ tool (xem bước tiếp theo).</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">📋 Ôn tập</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Tóm tắt buổi học / Study Notes / Flashcards / Inspector.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">📊 Stats</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Thống kê token, chi phí, cache hit, số câu đã nộp.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">💾 Cache</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Xem/xóa cache đáp án. Câu trùng lặp trả lời tức thì.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">📺 Activity</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Panel log real-time. Phím tắt: <code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;">Ctrl+Shift+A</code>.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">📜 Changelog</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Lịch sử cập nhật các phiên bản.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">📖 Hướng dẫn</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Mở lại hướng dẫn này bất cứ lúc nào.</div></div>
                <div style="padding:11px 13px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🙈 Ẩn</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Ẩn/hiện toàn bộ thanh công cụ (khi ẩn, tắt mọi popup).</div></div>
            </div>
        `;

        const step5Body = `
            <p style="margin:0 0 14px;font-size:13.5px;color:#334155;line-height:1.65;">Bấm <b>⚙️</b> để mở Cài đặt. Các tab quan trọng:</p>
            <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;">
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🎯 Quick</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Profiles nhanh (Grind / Stealth / Exam / AFK / Human / Ninja...) — bấm 1 nút là xong. Cũng có Prompt riêng.</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">⏱️ Timing</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Tốc độ tool, delay trước khi gửi, auto-type (gõ từ từ), chờ nút "Sẵn sàng".</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🤖 AI</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Chọn model, độ thông minh (Smartness), ensemble voting (bầu đáp án nhiều lần), recheck.</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🎭 Style</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Ngôn ngữ (VN/Anh), ký hiệu Toán/Lý/Hoá, lọc ID/rác, tiếng lóng, cố tình sai.</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🧠 Smart</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Hành vi nâng cao: nhận diện môn học, gõ typo giống người, mệt mỏi, chống nộp trùng, tự dừng khi sai nhiều.</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">💾 Cache / 🖼️ Vision / 📺 Activity</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Cấu hình cache đáp án, đọc ảnh, panel log.</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🔑 Keys</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Quản lý API key và đặt phím tắt cá nhân.</div></div>
                <div style="padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;"><b style="color:#0f172a;">🩹 Selectors</b><div style="color:#64748b;font-size:11.5px;margin-top:3px;line-height:1.5;">Self-healing khi FPT đổi cấu trúc DOM (thường không cần bật).</div></div>
            </div>
        `;

        const step6Body = `
            <div style="text-align:center;padding:8px 0 4px;">
                <div style="font-size:60px;margin-bottom:10px;line-height:1;">🚀</div>
                <h2 style="margin:0 0 8px;font-size:21px;color:#0f172a;letter-spacing:-0.02em;font-weight:700;">Sẵn sàng sử dụng!</h2>
                <p style="margin:0 0 20px;font-size:13.5px;color:#64748b;line-height:1.6;">Chỉ cần bật Auto Chat và tool sẽ tự làm việc.</p>
            </div>
            <ol style="margin:0 0 18px;padding-left:22px;font-size:13.5px;color:#334155;line-height:1.9;">
                <li>Vào bài học trên FPT EduNext</li>
                <li>Bấm <b style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:6px;">⚡ Auto Chat: OFF</b> → đổi thành <b style="color:#059669;">ON</b></li>
                <li>Tool sẽ tự phát hiện câu hỏi và trả lời</li>
                <li>Xem tiến trình real-time ở <b>📺 Activity Panel</b></li>
            </ol>
            <div style="padding:14px 16px;background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1.5px solid #c7d2fe;border-radius:12px;">
                <div style="font-size:13px;font-weight:700;color:#3730a3;margin-bottom:9px;">💡 Mẹo hữu ích</div>
                <ul style="margin:0;padding-left:20px;font-size:12.5px;color:#4338ca;line-height:1.85;">
                    <li><b>Ctrl+Shift+A</b> — mở nhanh Activity Panel</li>
                    <li>Bật <b>🎓 Nhận diện môn</b> ở <i>Settings → Smart</i> nếu làm đề tổng hợp — AI sẽ trả lời đúng văn phong từng môn (Văn / Anh / Toán / Lý / Hoá / Kinh tế-PL)</li>
                    <li>Dùng profile <b>🎭 Stealth</b> hoặc <b>🧑 Human</b> ở tab Quick nếu muốn giống người thật</li>
                    <li>Xem <b>📊 Stats</b> để theo dõi token và chi phí</li>
                    <li>Bấm <b>📖</b> bất cứ lúc nào để xem lại hướng dẫn này</li>
                </ul>
            </div>
        `;

        const STEPS = [
            { emoji: '👋', title: 'Chào mừng đến Auto Chat!', subtitle: 'Giới thiệu công cụ và tính năng chính', body: step1Body },
            { emoji: '🔑', title: 'Bước 1 — Lấy API Key (miễn phí)', subtitle: 'Chọn provider phù hợp và tạo key', body: step2Body },
            { emoji: '➕', title: 'Bước 2 — Thêm key vào tool', subtitle: 'Dán key vào form thêm key', body: step3Body },
            { emoji: '🎛️', title: 'Thanh công cụ — Các nút chính', subtitle: 'Góc trên bên phải màn hình', body: step4Body },
            { emoji: '⚙️', title: 'Cài đặt (Settings) — Từng tab', subtitle: 'Bấm ⚙️ để mở cài đặt', body: step5Body },
            { emoji: '🚀', title: 'Bắt đầu sử dụng!', subtitle: 'Mẹo và lối tắt', body: step6Body }
        ];

        function finish(completed) {
            if (onClose) onClose(completed);
            overlay.remove();
        }

        function render() {
            const s = STEPS[step];
            const isFirst = step === 0;
            const isLast = step === TOTAL - 1;
            box.innerHTML = `
                <div class="ac-dialog-header">
                    <div style="min-width:0;flex:1;">
                        <h3 class="ac-dialog-title"><span>${s.emoji}</span> ${s.title}</h3>
                        <p class="ac-dialog-subtitle">${s.subtitle}</p>
                    </div>
                    <button class="ac-dialog-close" id="tut-close">×</button>
                </div>
                <div style="padding:14px 24px 0;display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    ${STEPS.map((_, i) => `<span style="width:${i === step ? '26px' : '8px'};height:8px;border-radius:4px;background:${i <= step ? '#6366f1' : '#e2e8f0'};transition:all 0.22s cubic-bezier(0.16,1,0.3,1);"></span>`).join('')}
                    <span style="margin-left:auto;font-size:11.5px;color:#64748b;font-weight:600;font-family:ui-monospace,monospace;">Bước ${step + 1}/${TOTAL}</span>
                </div>
                <div class="ac-dialog-body" style="padding-top:18px;">${s.body}</div>
                <div class="ac-dialog-footer">
                    <button class="ac-btn ac-btn-secondary" id="tut-prev" ${isFirst ? 'disabled style="visibility:hidden;"' : ''}>← Trước</button>
                    <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
                        ${!isLast ? `<button class="ac-btn ac-btn-secondary" id="tut-skip" style="background:transparent;border:none;color:#94a3b8;font-size:12.5px;">Bỏ qua</button>` : ''}
                        <button class="ac-btn ac-btn-primary" id="tut-next">${isLast ? '✅ Bắt đầu' : 'Tiếp →'}</button>
                    </div>
                </div>
            `;

            document.getElementById('tut-close').onclick = () => finish(false);
            document.getElementById('tut-prev').onclick = () => { if (step > 0) { step--; render(); } };
            document.getElementById('tut-next').onclick = () => {
                if (step < TOTAL - 1) { step++; render(); }
                else finish(true);
            };
            const skipBtn = document.getElementById('tut-skip');
            if (skipBtn) skipBtn.onclick = () => finish(false);
        }

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });
        render();
    }

    // ============================================================
    // CHANGELOG
    // ============================================================
    function showChangelogDialog() {
        document.getElementById('auto-chat-changelog-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'auto-chat-changelog-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '640px';
        const renderEntry = (e) => {
            const isC = e.version === CURRENT_VERSION;
            const accent = isC ? '#6366f1' : '#94a3b8';
            const bg = isC ? '#eef2ff' : '#f8fafc';
            const badge = isC ? '<span style="background:#6366f1;color:#fff;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;">HIỆN TẠI</span>' : '';
            const items = e.changes.map(c => `<li style="margin-bottom:6px;padding-left:4px;">${c}</li>`).join('');
            return `<div style="margin-bottom:18px;padding:15px 17px;border-radius:13px;background:${bg};border:1px solid ${isC ? '#c7d2fe' : '#e2e8f0'};"><div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;"><span style="font-family:ui-monospace,monospace;font-size:14px;font-weight:700;color:${accent};">v${e.version}</span>${badge}<span style="font-size:12px;color:#64748b;margin-left:auto;">${e.date}</span></div><div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:9px;">${e.title}</div><ul style="margin:0;padding-left:22px;font-size:12.5px;line-height:1.6;color:#334155;">${items}</ul></div>`;
        };
        box.innerHTML = `<div class="ac-dialog-header"><div><h3 class="ac-dialog-title">📜 Lịch sử cập nhật</h3><p class="ac-dialog-subtitle">Phiên bản: <b style="color:#6366f1;">v${CURRENT_VERSION}</b> · Credit: <b style="color:#4f46e5;">${escapeHtml(CREDIT_TEXT)}</b></p></div><button class="ac-dialog-close" id="changelog-close-x">×</button></div><div class="ac-dialog-body">${CHANGELOG.map(renderEntry).join('')}</div><div class="ac-dialog-footer"><button class="ac-btn ac-btn-primary" id="changelog-close">Đóng</button></div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        document.getElementById('changelog-close').onclick = close;
        document.getElementById('changelog-close-x').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        if (SETTINGS.lastSeenVersion !== CURRENT_VERSION) { SETTINGS.lastSeenVersion = CURRENT_VERSION; saveSettings(SETTINGS); updateChangelogBadge(); }
    }
    function updateChangelogBadge() {
        const btn = document.getElementById('changelog-btn'); if (!btn) return;
        const hasNew = SETTINGS.lastSeenVersion !== CURRENT_VERSION;
        btn.classList.toggle('ac-has-badge', hasNew);
        btn.title = hasNew ? `Có cập nhật: v${CURRENT_VERSION}` : 'Lịch sử';
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    async function summarizeLesson() {
        const messages = getAllAIMessages();
        if (messages.length === 0) return '❌ Chưa có tin nhắn.';
        const keyEntry = getActiveKey(); if (!keyEntry) return '❌ Chưa có API Key hợp lệ.';
        const cleaned = messages.map(m => sanitizeIds(sanitizeUiChrome(m))).filter(m => m && !m.startsWith('❌') && m.length > 10);
        if (cleaned.length === 0) return '❌ Không có nội dung.';
        const mt = cleaned.join('\n\n---\n\n').substring(0, 9000);
        let logText = '';
        if (sessionLog.length > 0) logText = '\n\n=== LỊCH SỬ ===\n' + sessionLog.slice(-30).map((e, i) => `[${i + 1}] Đề: ${e.question}\n    Đã nộp: ${e.answer}`).join('\n');
        const sys = 'Bạn là học sinh vừa hoàn thành buổi học. TÓM TẮT BUỔI HỌC bằng TIẾNG VIỆT. Định dạng:\n📌 Chủ đề chính\n📝 Các dạng bài tập (3-7)\n🧮 Kiến thức/công thức (3-7)\n✅ Mức độ hoàn thành\n💡 Nhận xét\n\n150-350 từ.';
        const user = 'Đọc và tóm tắt:\n\n' + mt + logText;
        try { let c = await callProvider({ system: sys, user, temperature: 0.3, maxTokens: 1500, timeout: 90000 }); return sanitizeDegreeSymbol(c); }
        catch (e) { return '❌ ' + e.message; }
    }

    async function generateStudyNotes() {
        const messages = getAllAIMessages();
        if (messages.length === 0) return '❌ Chưa có tin nhắn.';
        const keyEntry = getActiveKey(); if (!keyEntry) return '❌ Chưa có API Key hợp lệ.';
        const cleaned = messages.map(m => sanitizeIds(sanitizeUiChrome(m))).filter(m => m && !m.startsWith('❌') && m.length > 10);
        if (cleaned.length === 0) return '❌ Không có nội dung.';
        const mt = cleaned.join('\n\n---\n\n').substring(0, 9000);
        let logText = '';
        if (sessionLog.length > 0) logText = '\n\n=== Q&A ĐÃ NỘP ===\n' + sessionLog.slice(-40).map((e, i) => `[${i + 1}] Đề: ${e.question}\n    Đáp án: ${e.answer}`).join('\n');
        const sys = 'Bạn là học sinh giỏi đang soạn STUDY NOTES cho buổi học vừa xong. Trả lời bằng TIẾNG VIỆT, định dạng Markdown rõ ràng:\n\n# 📚 Study Notes\n\n## 1. Khái niệm cốt lõi\n(3-7 khái niệm)\n\n## 2. Công thức & Quy tắc\n(liệt kê mọi công thức/quy tắc)\n\n## 3. Dạng bài đã gặp\n(3-5 dạng)\n\n## 4. Bẫy & Lỗi thường gặp\n(3-5 lỗi)\n\n## 5. Mẹo ghi nhớ\n(2-4 mẹo)\n\nGiữ ngắn gọn, súc tích.';
        const user = 'Dựa vào nội dung buổi học:\n\n' + mt + logText;
        try {
            const c = await callProvider({ system: sys, user, temperature: 0.4, maxTokens: 2500, timeout: 120000 });
            return sanitizeDegreeSymbol(c);
        } catch (e) { return '❌ ' + e.message; }
    }

    function showSummaryDialog() {
        document.getElementById('auto-chat-summary-dialog')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'auto-chat-summary-dialog';
        overlay.className = 'ac-dialog-overlay ac-root';
        const box = document.createElement('div');
        box.className = 'ac-dialog';
        box.style.maxWidth = '820px';
        const msgCount = getAllAIMessages().length;
        const logCount = sessionLog.length;
        const fcCount = rejectedQA.length;
        const trCount = decisionTraces.length;
        let activeTab = 'summary';

        box.innerHTML = `
            <div class="ac-dialog-header">
                <div>
                    <h3 class="ac-dialog-title">📋 Ôn tập buổi học</h3>
                    <p class="ac-dialog-subtitle">${msgCount} tin AI · ${logCount} lần nộp · ${fcCount} flashcards · ${trCount} traces</p>
                </div>
                <button class="ac-dialog-close" id="summary-close-x">×</button>
            </div>
            <div class="ac-tabs-wrapper">
                <div class="ac-tabs" id="summary-tabs-scroll">
                    <button type="button" class="ac-tab ac-tab-active" data-stab="summary"><span>📋</span><span>Tóm tắt</span></button>
                    <button type="button" class="ac-tab" data-stab="notes"><span>📚</span><span>Study Notes</span></button>
                    <button type="button" class="ac-tab" data-stab="flashcards"><span>📝</span><span>Flashcards (${fcCount})</span></button>
                    <button type="button" class="ac-tab" data-stab="inspector"><span>🔍</span><span>Inspector (${trCount})</span></button>
                </div>
            </div>
            <div class="ac-dialog-body" style="min-height:340px;">
                <div class="ac-tab-panel ac-tab-panel-active" data-stab-panel="summary">
                    <div id="summary-body" class="ac-summary-body">
                        <div class="ac-loading"><span class="ac-spinner"></span><span>Đang đọc...</span></div>
                    </div>
                </div>
                <div class="ac-tab-panel" data-stab-panel="notes">
                    <div id="notes-body" class="ac-summary-body">
                        <div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:13px;">
                            <div style="font-size:36px;margin-bottom:10px;">📚</div>
                            <div style="font-weight:600;color:#64748b;">Bấm "▶️ Tạo" để bắt đầu</div>
                        </div>
                    </div>
                </div>
                <div class="ac-tab-panel" data-stab-panel="flashcards">
                    <div id="flashcard-body">${renderFlashcardsHtml()}</div>
                </div>
                <div class="ac-tab-panel" data-stab-panel="inspector">
                    <div id="inspector-body"></div>
                </div>
            </div>
            <div class="ac-dialog-footer">
                <button class="ac-btn ac-btn-secondary" id="summary-run" style="margin-right:auto;">▶️ Tạo</button>
                <button class="ac-btn ac-btn-secondary" id="summary-copy">📄 Copy</button>
                <button class="ac-btn ac-btn-primary" id="summary-close">Đóng</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const summaryBody = document.getElementById('summary-body');
        const notesBody = document.getElementById('notes-body');
        const inspectorBody = document.getElementById('inspector-body');
        const runBtn = document.getElementById('summary-run');
        const copyBtn = document.getElementById('summary-copy');
        const closeBtn = document.getElementById('summary-close');
        const closeX = document.getElementById('summary-close-x');

        let summaryText = '';
        let notesText = '';
        let summaryGenerated = false;
        let notesGenerated = false;

        const close = () => overlay.remove();
        closeBtn.onclick = close; closeX.onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        renderInspector(inspectorBody);

        box.querySelectorAll('[data-stab]').forEach(tab => tab.addEventListener('click', () => {
            activeTab = tab.dataset.stab;
            box.querySelectorAll('[data-stab]').forEach(t => t.classList.toggle('ac-tab-active', t.dataset.stab === activeTab));
            box.querySelectorAll('.ac-tab-panel').forEach(p => p.classList.toggle('ac-tab-panel-active', p.dataset.stabPanel === activeTab));
            if (activeTab === 'summary' || activeTab === 'notes') {
                runBtn.style.display = 'inline-flex';
                runBtn.textContent = (activeTab === 'summary' && summaryGenerated) || (activeTab === 'notes' && notesGenerated) ? '🔄 Tạo lại' : '▶️ Tạo';
            } else {
                runBtn.style.display = 'none';
            }
        }));

        runBtn.onclick = () => {
            if (activeTab === 'summary') {
                summaryBody.innerHTML = '<div class="ac-loading"><span class="ac-spinner"></span><span>Đang tóm tắt...</span></div>';
                summaryGenerated = true; runBtn.textContent = '🔄 Tạo lại';
                summarizeLesson().then(r => { summaryText = r; summaryBody.style.color = r.startsWith('❌') ? '#dc2626' : ''; summaryBody.textContent = r; }).catch(e => { summaryBody.style.color = '#dc2626'; summaryBody.textContent = '❌ ' + e.message; });
            } else if (activeTab === 'notes') {
                notesBody.innerHTML = '<div class="ac-loading"><span class="ac-spinner"></span><span>Đang tạo Study Notes...</span></div>';
                notesGenerated = true; runBtn.textContent = '🔄 Tạo lại';
                generateStudyNotes().then(r => { notesText = r; notesBody.style.color = r.startsWith('❌') ? '#dc2626' : ''; notesBody.style.whiteSpace = 'pre-wrap'; notesBody.textContent = r; }).catch(e => { notesBody.style.color = '#dc2626'; notesBody.textContent = '❌ ' + e.message; });
            }
        };

        copyBtn.onclick = async () => {
            let text = '';
            if (activeTab === 'summary') { if (!summaryText) { showToast('Chưa có tóm tắt', 'info', 2000); return; } text = summaryText; }
            else if (activeTab === 'notes') { if (!notesText) { showToast('Chưa có Study Notes', 'info', 2000); return; } text = notesText; }
            else if (activeTab === 'flashcards') {
                if (rejectedQA.length === 0) { showToast('Chưa có flashcard', 'info', 2000); return; }
                text = rejectedQA.map((c, i) => `#${i + 1} (${c.attempts} lần${c.confidence !== null ? `, conf ${c.confidence}/10` : ''})\nQ: ${c.question}\nA: ${c.answer}`).join('\n\n---\n\n');
            } else if (activeTab === 'inspector') {
                if (decisionTraces.length === 0) { showToast('Chưa có trace', 'info', 2000); return; }
                text = renderTracesAsText();
            }
            try { await navigator.clipboard.writeText(text); copyBtn.textContent = '✅'; setTimeout(() => { copyBtn.textContent = '📄 Copy'; }, 1500); } catch (e) {}
        };

        runBtn.click();
    }

    function renderInspector(container) {
        if (decisionTraces.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:13px;">
                <div style="font-size:36px;margin-bottom:10px;">🔍</div>
                <div style="font-weight:600;color:#64748b;">Chưa có trace nào</div>
            </div>`;
            return;
        }
        container.innerHTML = decisionTraces.slice().reverse().map((t, idx) => renderTrace(t, decisionTraces.length - 1 - idx)).join('');
        container.querySelectorAll('.ac-trace-header').forEach(h => h.onclick = () => {
            const body = h.nextElementSibling;
            if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
        });
    }

    function renderTrace(t, idx) {
        const ts = new Date(t.time).toLocaleTimeString('vi-VN');
        const status = t.error ? '❌' : (t.cacheHit ? '⚡' : '✅');
        const statusColor = t.error ? '#dc2626' : (t.cacheHit ? '#f59e0b' : '#059669');
        const stepsHtml = t.steps.map(s => `
            <div style="margin-bottom:10px;padding:9px 11px;background:#fff;border:1px solid #e2e8f0;border-left:3px solid #6366f1;border-radius:7px;">
                <div style="font-weight:700;font-size:11.5px;color:#0f172a;margin-bottom:5px;">${escapeHtml(s.label)}</div>
                ${s.before ? `<div style="font-size:11px;font-family:ui-monospace,monospace;color:#64748b;margin-bottom:4px;"><b>BEFORE:</b> <span style="color:#334155;">${escapeHtml(s.before)}</span></div>` : ''}
                ${s.after ? `<div style="font-size:11px;font-family:ui-monospace,monospace;color:#64748b;margin-bottom:4px;"><b>AFTER:</b> <span style="color:#059669;">${escapeHtml(s.after)}</span></div>` : ''}
                ${s.note ? `<div style="font-size:11.5px;line-height:1.55;color:#334155;white-space:pre-wrap;word-break:break-word;">${escapeHtml(s.note)}</div>` : ''}
            </div>
        `).join('');
        const metaHtml = `
            <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;margin-bottom:10px;">
                ${t.model ? `<span style="background:#eef2ff;color:#6366f1;padding:2px 9px;border-radius:7px;font-weight:700;">${escapeHtml(t.provider || '')} · ${escapeHtml(t.model)}</span>` : ''}
                ${t.confidence !== null && t.confidence !== undefined ? `<span style="background:#fef3c7;color:#d97706;padding:2px 9px;border-radius:7px;font-weight:700;">conf ${t.confidence}/10</span>` : ''}
                ${t.cacheHit ? `<span style="background:#fef3c7;color:#d97706;padding:2px 9px;border-radius:7px;font-weight:700;">cache ${escapeHtml(t.cacheHit)}</span>` : ''}
                ${t.recheck ? `<span style="background:#ecfdf5;color:#059669;padding:2px 9px;border-radius:7px;font-weight:700;">recheck ${t.recheck.passes}×</span>` : ''}
                ${t.error ? `<span style="background:#fef2f2;color:#dc2626;padding:2px 9px;border-radius:7px;font-weight:700;">ERROR</span>` : ''}
            </div>
        `;
        return `<div style="margin-bottom:12px;padding:13px 15px;border:1.5px solid #e2e8f0;border-radius:11px;background:#fafbfc;">
            <div class="ac-trace-header" style="display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none;">
                <span style="font-size:16px;">${status}</span>
                <span style="font-size:11px;color:#94a3b8;font-family:ui-monospace,monospace;">${ts}</span>
                <span style="font-size:11.5px;color:#334155;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${escapeHtml(t.question.substring(0, 100))}</span>
                <span style="color:${statusColor};font-weight:700;font-size:11px;">#${idx + 1}</span>
            </div>
            <div style="margin-top:12px;display:none;">
                ${metaHtml}
                ${stepsHtml}
            </div>
        </div>`;
    }

    function renderTracesAsText() {
        return decisionTraces.slice().reverse().map((t, idx) => {
            const ts = new Date(t.time).toLocaleString('vi-VN');
            const steps = t.steps.map(s => {
                let out = `  • ${s.label}`;
                if (s.before) out += `\n      BEFORE: ${s.before}`;
                if (s.after) out += `\n      AFTER: ${s.after}`;
                if (s.note) out += `\n      ${s.note}`;
                return out;
            }).join('\n');
            return `[${idx + 1}] ${ts}\nQ: ${t.question}\nModel: ${t.provider}/${t.model}${t.confidence !== null ? ' (conf ' + t.confidence + '/10)' : ''}${t.cacheHit ? ' [CACHE]' : ''}\n${steps}`;
        }).join('\n\n' + '─'.repeat(50) + '\n\n');
    }

    // ============================================================
    // DOM HELPERS
    // ============================================================
    const getCapturedCanvasMessage = () => {
        const active = Array.from(capturedCanvasText.entries())
            .filter(([canvas, record]) => document.contains(canvas) && Date.now() - record.updatedAt < 120_000 && record.lines.length)
            .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
            .slice(0, 4);
        const lines = [];
        for (const [, record] of active) for (const raw of record.lines) {
            const line = String(raw || '').trim();
            if (line.length < 4 || /^[\da-f-]{12,}$/i.test(line) || /^(feedback|sửa công thức|đã chấm bằng ai|int:\s*)/i.test(line)) continue;
            if (lines[lines.length - 1] !== line && !lines.includes(line)) lines.push(line);
        }
        return lines.slice(-100).join('\n').trim();
    };
    function findEduNextMessages() {
        // Ưu tiên 1: Quét trực tiếp các khối nội dung bài tập / câu hỏi trong chat view
        const candidates = Array.from(document.querySelectorAll('div, section, article, p')).filter(el => {
            if (isInternalUi(el)) return false;
            if (el.closest('.chat-footer, [class*="toolbar"], #ac-activity-panel, .message-meta-row')) return false;
            const t = (el.innerText || '').trim();
            if (t.length < 15 || t.length > 5000) return false;
            return /bạn hãy làm bài|làm bài sau|câu hỏi|trả lời:|đáp án|sẵn sàng|question|exercise|phương trình|thất nghiệp|lạm phát/i.test(t);
        });

        if (candidates.length > 0) {
            return candidates;
        }

        // Ưu tiên 2: Tìm các thẻ message bubble chuẩn của EduNext
        const standard = Array.from(document.querySelectorAll(
            '.message-content, [class*="message-content"], [class*="messageContent"], [class*="assistant-message"], [class*="chat-message"], .prose, [class*="markdown"]'
        )).filter(el => !isInternalUi(el) && !el.closest('.message-meta-row, [class*="meta"]') && (el.innerText || '').trim().length > 5);

        return standard;
    }

    function stripNoiseFromMessage(t) {
        if (!t) return '';
        return String(t)
            .replace(/[0-9a-f]{8}-[0-9a-f-]{20,}/gi, ' ')
            .replace(/\b[0-9a-f]{20,}\b/gi, ' ')
            .replace(/\b\d{2}:\d{2}:\d{2}\s+\d{1,2}\/\d{1,2}\/\d{4}\b/g, ' ')
            .replace(/đã chấm bằng ai|int:\s*\w+|feedback|sửa công thức/gi, ' ')
            .replace(/\s+/g, ' ').trim();
    }
    function isSubstantiveMessage(text) {
        if (!text) return false;
        const clean = stripNoiseFromMessage(text);
        if (!clean) return false;
        if (/(?:bạn|em|thầy|cô)?\s*sẵn\s*sàng|ready\b/i.test(clean)) return true;
        if (isExercise(clean) || isComplaint(clean) || isLessonEnded(clean)) return true;
        return clean.length >= 10;
    }
    const getAllAIMessages = () => {
        const nodes = resolveSelector('messageStack', { multi: true }) || [];
        const raw = nodes.map(n => n.innerText?.trim()).filter(Boolean);
        let messages = raw.filter(t => isSubstantiveMessage(t));
        if (!messages.length && raw.length) {
            messages = raw.filter(t => t.length > 5);
        }
        const rendered = getCapturedCanvasMessage();
        const readableDOM = messages.some(t => isSubstantiveMessage(t) && t.length > 35);
        if (rendered.length > 30 && !readableDOM) {
            messages.push(rendered);
            const h = hashQuestion(rendered.slice(-500));
            if (h !== lastCanvasTextHash) { lastCanvasTextHash = h; logActivity('info', `Đọc được nội dung hiển thị từ canvas (${rendered.length} ký tự)`); }
        }
        return messages;
    };
    const countAIMessages = () => getAllAIMessages().length;
    const getLatestHash = () => { const m = getAllAIMessages(); return m.length === 0 ? '' : hashMessage(m[m.length - 1]); };
    function isEnglishQuestion(text) {
        if (!text) return false;
        if (/Please try the exercise|Use this answer format|Answer\s*:\s*\[your answer\]|Please answer the following|Answer the following question|Choose the correct answer|Fill in the blank|Read the following passage/i.test(text)) return true;
        if (/\bQuestion\b/i.test(text) && (/\bAnswer\s*:/i.test(text) || /\b[A-D][\.\)]\s+\S/.test(text))) return true;
        const cleaned = sanitizeUiChrome(text);
        if (isLikelyEnglish(cleaned)) return true;
        return false;
    }
    function isExercise(text) {
        if (!text) return false;
        // Bỏ qua các thẻ gợi ý thuần túy (không phải đề bài)
        if (/^\s*gợi\s*ý\b/i.test(text) || /câu trả lời .* chưa cung cấp con số/i.test(text)) return false;
        const hm = text.includes('Câu hỏi') || text.includes('Trả lời:') || text.includes('Hãy trả lời') || text.includes('trả lời theo') || text.includes('điền đáp án')
            || /làm bài sau|bài tập sau|hãy làm bài|trả lời câu hỏi|chọn đáp án/i.test(text)
            || /(?:như thế nào|tại sao|vì sao|đúng hay sai|theo em|hậu quả nào|ý kiến nào|hành vi nào|quan điểm nào).*(?:\?|\:)/i.test(text)
            || /Please try the exercise/i.test(text)
            || /Use this answer format/i.test(text)
            || /\bAnswer\s*:\s*\[your answer\]/i.test(text)
            || /\bAnswer\s*:/i.test(text)
            || (/\bQuestion\b/i.test(text) && (/\bAnswer\s*:/i.test(text) || /\b[A-D][\.\)]\s+\S/.test(text) || /\?/.test(text)))
            || /Please answer the following|Answer the following question|Choose the correct answer|Fill in the blank|Complete the following/i.test(text);
        const directAcademicQuestion = /\b(?:tính|tìm|xác định|giải|calculate|compute|determine|solve|find)\b/i.test(text)
            && /(?:\d+(?:[.,]\d+)?\s*(?:kg|g|m\/s|km\/h|cm|mm|m|s|N|J|W|Hz|mol)\b|[=+\-*/^]|động năng|thế năng|vận tốc|gia tốc|khối lượng|quãng đường|thời gian|phương trình|diện tích|chu vi|thể tích|xác suất)/i.test(text);
        if (!hm && !directAcademicQuestion) return false;
        if (/sẵn sàng chuyển sang|bạn đã sẵn sàng|are you ready|ready to move on|ready to start|ready to begin|shall we move on/i.test(text)) return false;
        if (/^nội dung phần này|^content of this section|^in this section,?\s+we will/i.test(text)) return false;
        return true;
    }
    function isComplaint(text) {
        if (!text) return false;
        const l = text.toLowerCase();
        return l.includes('chưa thực hiện') || l.includes('chưa chính xác') || l.includes('chưa đúng') || l.includes('hãy kiểm tra lại') || l.includes('câu trả lời vừa rồi') || l.includes('có vẻ như bạn đã')
            || l.includes('not correct') || l.includes('incorrect') || l.includes('not quite right') || l.includes('not accurate') || l.includes('inaccurate')
            || l.includes('try again') || l.includes('check again') || l.includes('check your answer') || l.includes('wrong answer')
            || l.includes("haven't completed") || l.includes('have not completed') || l.includes("haven't answered") || l.includes('have not answered')
            || l.includes('your previous answer') || l.includes('your last answer') || l.includes('it seems you have');
    }
        function getLatestChatState() {
        try {
            const studentBadges = Array.from(document.querySelectorAll('span, div, p, small, label')).filter(el => {
                if (isInternalUi(el)) return false;
                return /^học\s*sinh$/i.test((el.innerText || '').trim());
            });

            const teacherBadges = Array.from(document.querySelectorAll('button, a, span, div, p')).filter(el => {
                if (isInternalUi(el)) return false;
                const t = (el.innerText || '').trim();
                return /^(?:feedback|sửa công thức)$/i.test(t) || /đã chấm bằng ai/i.test(t) || /^int:\s*\w+/i.test(t);
            });

            const lastStudent = studentBadges.length > 0 ? studentBadges[studentBadges.length - 1] : null;
            const lastTeacher = teacherBadges.length > 0 ? teacherBadges[teacherBadges.length - 1] : null;

            if (!lastTeacher && !lastStudent) {
                // Nếu chưa tìm thấy badge chuẩn, quét fallback khối tin nhắn
                const fallbackMsg = getLatestFallbackMessage();
                if (fallbackMsg) return { state: 'student_turn', teacherBadge: document.body, messageEl: document.body, text: fallbackMsg };
                return { state: 'idle' };
            }

            // Nếu học sinh xuất hiện sau giáo viên -> Học sinh đã gửi bài, đang chờ giáo viên chấm/ra câu mới
            if (lastStudent && lastTeacher && (lastTeacher.compareDocumentPosition(lastStudent) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                return { state: 'waiting_teacher', lastStudent, lastTeacher };
            }
            if (lastStudent && !lastTeacher) {
                return { state: 'waiting_teacher', lastStudent, lastTeacher: null };
            }

            // Đến lượt học sinh trả lời! Lấy khối tin nhắn của giáo viên
            let curr = lastTeacher;
            let messageEl = curr;
            while (curr && curr !== document.body && !curr.classList?.contains('wrap-message-view')) {
                if (lastStudent && curr.contains(lastStudent)) break;
                const txt = (curr.innerText || '').trim();
                if (txt.length > 25 && (txt.includes('Câu hỏi') || txt.includes('Bài sau') || txt.includes('bài sau') || txt.includes('Trả lời:') || txt.includes('Chính xác') || txt.includes('sẵn sàng') || txt.includes('hoàn thành') || txt.length > 50)) {
                    messageEl = curr;
                }
                curr = curr.parentElement;
            }

            const text = stripNoiseFromMessage(messageEl.innerText || '');
            return {
                state: 'student_turn',
                teacherBadge: lastTeacher,
                messageEl,
                text
            };
        } catch (e) {
            return { state: 'idle' };
        }
    }

    function getLatestFallbackMessage() {
        const m = getAllAIMessages();
        if (m.length > 0) {
            for (let i = m.length - 1; i >= 0; i--) if (isSubstantiveMessage(m[i])) return m[i];
            return m[m.length - 1];
        }
        return null;
    }

    function getLatestAIMessage() {
        const chat = getLatestChatState();
        if (chat.state === 'student_turn' && chat.text) return chat.text;
        return null;
    }
    const getLatestExercise = () => { const m = getAllAIMessages(); for (let i = m.length - 1; i >= 0; i--) if (isExercise(m[i])) return m[i]; return null; };

    // ============================================================
    // KEYBIND HELPERS
    // ============================================================
    function eventToKeybind(e) {
        const mods = [];
        if (e.ctrlKey) mods.push('ctrl');
        if (e.altKey) mods.push('alt');
        if (e.shiftKey) mods.push('shift');
        if (e.metaKey) mods.push('meta');
        let k = e.key;
        if (['Control','Shift','Alt','Meta','CapsLock'].includes(k)) return null;
        if (k === ' ') k = 'Space';
        if (k.length === 1) k = k.toLowerCase();
        return [...mods, k].join('+');
    }
    function matchesKeybind(e, kb) {
        if (!kb) return false;
        const p = kb.split('+'); const kp = p.pop(); const m = new Set(p.map(x => x.toLowerCase()));
        if (m.has('ctrl') !== e.ctrlKey) return false;
        if (m.has('alt') !== e.altKey) return false;
        if (m.has('meta') !== e.metaKey) return false;
        if (m.has('shift') !== e.shiftKey) return false;
        let ek = e.key;
        if (ek === ' ') ek = 'Space';
        if (ek.length === 1) ek = ek.toLowerCase();
        return ek.toLowerCase() === kp.toLowerCase();
    }
    function formatKeybindDisplay(kb) {
        if (!kb) return 'Chưa đặt';
        const p = kb.split('+'); const k = p.pop();
        const mods = p.map(x => x.charAt(0).toUpperCase() + x.slice(1));
        const kd = k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
        return [...mods, kd].join(' + ');
    }

    // ============================================================
    // SESSION VARS + DECISION TRACES
    // ============================================================
    const sessionLog = [];
    const SESSION_LOG_MAX = 300;
    let isAwaitingNextQuestion = false;
    let lastAnsweredQuestionKey = '';
    let lastAnsweredTime = 0;

    function isTransientStatusMessage(text) {
        if (!text) return false;
        const str = String(text).trim();
        return /(?:đang\s+(?:xử\s*lý|phân\s*tích|chấm\s*điểm|kiểm\s*tra|tải)|hệ\s*thống\s*vẫn\s*đang\s*xác\s*minh|hãy\s*giữ\s*nguyên\s*câu\s*hỏi|chờ\s*(?:chút|một\s*chút|giây\s*lát)|loading\b|processing\b|analyzing\b)/i.test(str);
    }
    let consecutiveFailures = 0;
    let questionCount = 0;
    let lastSubmittedText = '';
    let aiFailureCount = 0;
    let lastConfidence = null;
    let confidencePaused = false;
    let rejectedQA = [];
    let lastSubject = 'generic';
    const ANSWERED_QUESTION_STORE_KEY = 'auto_chat_answered_question_ledger_v1';
    function loadAnsweredQuestionLedger() {
        try {
            const raw = GM_getValue(ANSWERED_QUESTION_STORE_KEY, '[]');
            const rows = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
            return new Map(rows.filter(row => row && row.key).map(row => [row.key, row]));
        } catch (_) { return new Map(); }
    }
    const answeredQuestionLedger = loadAnsweredQuestionLedger();
    function saveAnsweredQuestionLedger() {
        try { GM_setValue(ANSWERED_QUESTION_STORE_KEY, JSON.stringify([...answeredQuestionLedger.values()].slice(-250))); } catch (_) {}
    }
    function getQuestionIdentity(text) {
        if (!text) return '';
        const source = String(text || '');
        let canonical = stripNoiseFromMessage(source);
        canonical = sanitizeIds(sanitizeUiChrome(canonical));
        // Loại bỏ phần lời khen/chuyển tiếp ở đầu tin nhắn của GV (ví dụ: "Chính xác! Bạn nhớ đúng con số 33...")
        canonical = canonical.replace(/^(?:chính xác|hoan hô|rất tốt|chúc mừng|tuyệt vời|đúng rồi)[^.\n]*[.!\s]*/i, '');
        canonical = canonical.replace(/^(?:mình tiếp tục|chúng ta tiếp tục|tiếp tục với|hãy tiếp tục)[^.\n]*[:.!\s]*/i, '');
        const anchors = [...canonical.matchAll(/(?:câu hỏi\s*:|bạn hãy làm bài sau nhé\s*:|làm bài sau\s*:|thử lại lần nữa nhé\s*:|please try the exercise(?: below)?\s*:)/gi)];
        if (anchors.length) {
            canonical = canonical.slice(anchors[anchors.length - 1].index);
        }
        canonical = canonical.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 1800);
        return canonical ? 'text:' + hashMessage(canonical) : '';
    }
    function mayProcessQuestion(key, isCorrection) {
        if (!key) return true;
        const row = answeredQuestionLedger.get(key);
        if (!row) return true;
        // Nếu câu trước lỡ gửi "Sẵn sàng" mà giáo viên phản hồi cần trả lời bài tập -> Cho phép giải lại ngay
        if (/^\s*sẵn\s*sàng\s*$/i.test(row.answer || '')) return true;
        // Cho phép sửa sai tối đa 2 lần khi giáo viên phản hồi
        return (isCorrection && (row.corrections || 0) < 2);
    }
    function markQuestionHandled(key, answer, isCorrection = false) {
        if (!key) return;
        const previous = answeredQuestionLedger.get(key);
        answeredQuestionLedger.set(key, {
            key,
            answer: String(answer || '').slice(0, 240),
            corrections: (previous?.corrections || 0) + (isCorrection ? 1 : 0),
            state: 'drafted',
            updatedAt: Date.now()
        });
        while (answeredQuestionLedger.size > 250) answeredQuestionLedger.delete(answeredQuestionLedger.keys().next().value);
        saveAnsweredQuestionLedger();
    }
    function readComposerDraft() {
        const ta = resolveSelector('textarea');
        return String(ta?.value || ta?.innerText || ta?.textContent || '').trim();
    }
    function buildDraftCorrectionPrompt(question, draft) {
        let q = sanitizeIds(sanitizeUiChrome(String(question || '')));
        if (q.length > 1800) q = q.slice(0, 900) + '\n…\n' + q.slice(-800);
        const d = String(draft || '').trim().slice(0, 500);
        return `Đề và phản hồi mới nhất:\n${q}\n\nĐáp án đang có:\n${d}\n\nKiểm tra và sửa đáp án nếu sai; nếu đúng thì giữ nguyên. Chỉ xuất đáp án ngắn theo đúng mẫu đề, không giải thích.`;
    }
    function isInternalControlAnswer(text) {
        return /_{0,2}\s*(?:NO_QUESTION|LESSON_COMPLETE)\s*_{0,2}/i.test(String(text || ''));
    }
    function isInternalUi(el) {
        if (!el) return false;
        return !!el.closest('.ac-root, [id^="ac-"], [class^="ac-"], [class*=" ac-"], #ac-activity-panel, #ac-button-bar, #ac-stats-dialog, #ac-changelog-modal, #ac-settings-dialog, #ac-toast-container');
    }

    function findReadyQuickReply() {
        try {
            const latest = getLatestAIMessage() || '';
            // Nếu khung chat hiện tại đang có câu hỏi / bài tập -> Tuyệt đối không tìm nút Sẵn sàng!
            const hasEx = isExercise(latest) || /câu hỏi|bài sau|hãy làm|trả lời:|đáp án|orbital|electron|nguyên tử|phương trình|\?/i.test(latest);
            if (hasEx) return null;

            const isReadyText = /bạn đã sẵn sàng|em đã sẵn sàng|sẵn sàng chuyển sang|are you ready|ready to move on|sẵn sàng chưa/i.test(latest);
            if (!isReadyText && latest.length > 30) return null;

            const candidates = Array.from(document.querySelectorAll(
                'button, [role="button"], .quick-reply, .chat-chip, .suggestion-item, [class*="chip"], [class*="quick"], [class*="suggestion"]'
            ));

            const studentBadges = Array.from(document.querySelectorAll('span, div, p, small, label')).filter(el => {
                if (isInternalUi(el)) return false;
                return /^học\s*sinh$/i.test((el.innerText || '').trim());
            });
            const lastStudentBadge = studentBadges.length > 0 ? studentBadges[studentBadges.length - 1] : null;

            for (const el of candidates) {
                if (isInternalUi(el)) continue;
                if (isForbiddenButton(el)) continue;
                if (el.disabled || el.offsetParent === null) continue;
                // Bắt buộc nút phải xuất hiện SAU tin nhắn gần nhất của học sinh (không lấy nút cũ ở lịch sử chat)
                if (lastStudentBadge && (el.compareDocumentPosition(lastStudentBadge) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    continue;
                }
                const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
                if (/^(?:sẵn\s*sàng|ready|tôi\s*đã\s*sẵn\s*sàng|i'm\s*ready|im\s*ready)[!.]?$/i.test(txt)) {
                    return el;
                }
            }
        } catch (_) {}
        return null;
    }

    function setReactValue(el, val) {
        if (!el) return false;
        try {
            el.focus();
            el.click();
            if (el.isContentEditable) {
                el.innerText = val;
                el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            const proto = (el instanceof HTMLTextAreaElement) ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (el._valueTracker) {
                try { el._valueTracker.setValue(''); } catch (_) {}
            }
            if (nativeSetter) {
                nativeSetter.call(el, val);
            } else {
                el.value = val;
            }
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val }));
            el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            return true;
        } catch (_) {
            try { el.value = val; } catch (_) {}
            return false;
        }
    }

    async function handleReadyState(rt = 'Sẵn sàng', quickBtn = null) {
        logActivity('submit', `Tự động gõ & gửi: "${rt}"`);
        showToast(`🚀 Đang gõ & gửi: ${rt}`, 'info', 2000);

        // 1. Bấm nút chip gợi ý nếu có
        if (quickBtn) {
            try {
                quickBtn.click();
                quickBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                lastSubmitTimestamp = Date.now();
                await new Promise(r => setTimeout(r, 600));
                setStatus('idle');
                return;
            } catch (_) {}
        }

        // 2. Luôn tự gõ chữ vào ô nhập để đảm bảo giá trị chắc chắn có trong composer
        setStatus('typing');
        await typeAnswer(rt);

        // 3. Nếu bật Auto Submit -> Kích hoạt nút gửi xanh hoặc Enter
        if (isAutoSubmitOn()) {
            await new Promise(r => setTimeout(r, 250));
            setStatus('submitting');
            await submitComposer();
            isAwaitingNextQuestion = true;
            lastAnsweredQuestionKey = 'ready_' + Date.now();
            lastAnsweredTime = Date.now();
            logActivity('done', `Đã gửi thành công: ${rt} (chỉ gửi 1 lần duy nhất)`);
            showToast(`✅ Đã gửi: ${rt}`, 'success', 2500);
        } else {
            logActivity('done', `Đã điền nháp: ${rt}`);
            showToast(`📝 Đã điền nháp: ${rt}`, 'info', 2000);
        }
        setStatus('idle');
    }

    async function deliverAnswer(key, answer, isCorrection = false, questionHash = '', isReady = false) {
        const currentMsg = getLatestAIMessage() || '';
        let formattedAnswer = formatAnswerToRequiredTemplate(answer, currentMsg);
        const clean = normalizeAnswerForComposer(formattedAnswer);
        if (!clean || isInternalControlAnswer(clean)) return false;

        // BẢO VỆ TỐI THƯỢNG: TUYỆT ĐỐI KHÔNG GỬI "SẴN SÀNG" NẾU ĐÂY LÀ BÀI TẬP / CÂU HỎI
        const isReadyAttempt = /^\s*(?:sẵn\s*sàng|ready)\s*[.!]?\s*$/i.test(clean);
        const currentMsg = getLatestAIMessage() || '';
        const hasEx = isExercise(currentMsg) || /câu hỏi|bài sau|hãy làm|trả lời|đáp án|tính|cho|tìm|chọn|orbital|nguyên tử|electron|phương trình|\?/i.test(currentMsg);
        if (isReadyAttempt && hasEx) {
            console.warn('[Auto Chat] CHẶN TUYỆT ĐỐI: Đáp án là "Sẵn sàng" nhưng đề bài đang có câu hỏi bài tập! Huỷ lệnh nộp.', { currentMsg: currentMsg.substring(0, 80) });
            logActivity('warn', 'Đã chặn gửi nhầm "Sẵn sàng" vào câu hỏi bài tập');
            return false;
        }

        // Nếu là prompt Ready / Sẵn sàng:
        if (isReady) {
            const quickBtn = findReadyQuickReply();
            await handleReadyState(clean, quickBtn);
            markQuestionHandled(key, clean, isCorrection);
            if (questionHash) lastProcessedHash = questionHash;
            return true;
        }

        // Điền vào ô nhập (hỗ trợ cả Auto Type progressive nếu bật)
        setStatus('typing');
        const typed = await typeAnswer(clean);
        if (!typed) return false;

        if (isAutoSubmitOn()) {
            setStatus('waiting');
            const cancelled = await waitBeforeSendDelay();
            if (cancelled || !isRunning) return false;

            setStatus('submitting');
            logActivity('submit', `Đang tự nộp câu trả lời: ${clean.substring(0, 100)}...`);
            const submitted = await clickSubmit();
            if (submitted) {
                lastSubmittedText = clean;
                isAwaitingNextQuestion = true;
                lastAnsweredQuestionKey = key;
                lastAnsweredTime = Date.now();
                markQuestionHandled(key, clean, isCorrection);
                if (questionHash) lastProcessedHash = questionHash;
                setStatus('idle');
                logActivity('done', 'Đã gửi đáp án 1 lần duy nhất. Đang đợi câu hỏi mới hiện lên chat...');
                showToast('📤 Đã gửi đáp án (1 lần duy nhất)', 'success', 2500);
                return true;
            } else {
                logActivity('warn', 'Không tìm thấy nút gửi; đáp án đã lưu trong ô soạn thảo.');
                showToast('⚠️ Đã điền xong (không tự bấm được nút gửi)', 'warn', 3500);
                markQuestionHandled(key, clean, isCorrection);
                if (questionHash) lastProcessedHash = questionHash;
                setStatus('idle');
                return true;
            }
        } else {
            markQuestionHandled(key, clean, isCorrection);
            if (questionHash) lastProcessedHash = questionHash;
            setStatus('idle');
            logActivity('done', 'Đã điền bản nháp. Hãy xem lại, chỉnh nếu cần rồi tự gửi.');
            showToast('📝 Đã điền nháp', 'info', 2000);
            return true;
        }
    }
    const fillDraftOnly = deliverAnswer;
    function recordSession(q, a) { sessionLog.push({ time: Date.now(), question: (q||'').substring(0,220), answer: (a||'').substring(0,220) }); while (sessionLog.length > SESSION_LOG_MAX) sessionLog.shift(); }

    const decisionTraces = [];
    const DECISION_TRACES_MAX = 60;
    function pushTrace(trace) {
        decisionTraces.push(trace);
        while (decisionTraces.length > DECISION_TRACES_MAX) decisionTraces.shift();
    }
    function makeTrace(question) {
        return {
            time: Date.now(),
            question: (question || '').substring(0, 300),
            steps: [],
            model: null, provider: null, keyName: null,
            rawResponse: null, finalResponse: null,
            confidence: null, recheck: null, cacheHit: null, error: null
        };
    }

    // ============================================================
    // TYPING
    // ============================================================
    function typeAnswerInstant(text) {
        const ta = resolveSelector('textarea'); if (!ta) return false;
        return setReactValue(ta, text);
    }
    async function typeAnswerProgressive(text) {
        const ta = resolveSelector('textarea'); if (!ta) return false;
        const preset = getAutoType(); const chars = Array.from(text); const total = chars.length;
        const fatigue = getFatigueMultiplier();
        let baseDelay = Math.round(preset.delay * fatigue);
        baseDelay = applyFingerprint(baseDelay, 'typing');
        baseDelay = applyResponseJitter(baseDelay);
        let budgetApplied = false;
        if (total > 0 && total * baseDelay > AUTO_TYPE_MAX_DURATION_MS) { baseDelay = Math.max(5, Math.floor(AUTO_TYPE_MAX_DURATION_MS / total)); budgetApplied = true; }
        try {
            ta.focus(); ta.click();
            const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
            const setV = v => { if (s) s.call(ta, v); else ta.value = v; ta.dispatchEvent(new Event('input', { bubbles:true, cancelable:true })); };
            setV('');
            let sinceLastPause = 0;
            let nextPauseAt = preset.humanPauses ? (12 + Math.floor(Math.random() * 18)) : Infinity;
            const ht = isHumanTouchOn();
            for (let i = 0; i < total; i++) {
                if (!isRunning) return false;
                const prefix = chars.slice(0, i).join(''); const correct = chars[i];
                if (ht && /[a-zA-Z0-9]/.test(correct) && Math.random() < 0.03) {
                    const wrong = getWrongChar(correct);
                    setV(prefix + wrong); await new Promise(r => setTimeout(r, 150 + Math.random() * 250));
                    setV(prefix); await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
                }
                setV(prefix + correct);
                let d = baseDelay;
                if (preset.jitter > 0 && !budgetApplied) d = baseDelay + (Math.random() * 2 - 1) * preset.jitter;
                d = Math.max(3, Math.round(d));
                if (preset.humanPauses && !budgetApplied) { sinceLastPause++; if (sinceLastPause >= nextPauseAt) { await new Promise(r => setTimeout(r, 300 + Math.floor(Math.random() * 600))); sinceLastPause = 0; nextPauseAt = 12 + Math.floor(Math.random() * 18); continue; } }
                await new Promise(r => setTimeout(r, d));
            }
            ta.dispatchEvent(new Event('change', { bubbles:true }));
            return true;
        } catch (e) { return false; }
    }
    async function typeAnswer(text) { const p = getAutoType(); if (p.mode === 'off') return typeAnswerInstant(text); return await typeAnswerProgressive(text); }

    const NEARBY_KEYS = { a:'s',b:'v',c:'x',d:'f',e:'r',f:'g',g:'h',h:'j',i:'o',j:'k',k:'l',l:'k',m:'n',n:'m',o:'p',p:'o',q:'w',r:'t',s:'d',t:'y',u:'i',v:'b',w:'e',x:'c',y:'u',z:'x','1':'2','2':'3','3':'4','4':'5','5':'6','6':'7','7':'8','8':'9','9':'0','0':'9' };
    function getWrongChar(correct) { const l = correct.toLowerCase(); if (NEARBY_KEYS[l]) { const w = NEARBY_KEYS[l]; return (correct === correct.toUpperCase() && correct !== correct.toLowerCase()) ? w.toUpperCase() : w; } return 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; }

    function ensureEditorInEditMode() {
        try {
            const previewEl = document.querySelector('.w-md-editor-preview');
            if (previewEl && previewEl.offsetParent !== null) {
                const previewBtn = document.querySelector('button[data-name="preview"], button[data-name="edit"]');
                if (previewBtn) previewBtn.click();
            }
        } catch (_) {}
    }

    function isForbiddenButton(el) {
        if (!el) return true;
        // TUYỆT ĐỐI BỎ QUA GIAO DIỆN CỦA SCRIPT
        if (isInternalUi(el)) return true;

        const cls = (el.className || '').toString().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const txt = (el.innerText || el.textContent || '').trim().toLowerCase();

        // 1. Chặn toàn bộ thanh công cụ Markdown (Preview, Bold, Italic, v.v.) và nút Định dạng văn bản
        if (el.closest('.w-md-editor-toolbar, .w-md-editor-toolbar-warp, [class*="toolbar"]') || el.hasAttribute('data-name') || cls.includes('w-format-toggle') || /định dạng/i.test(aria + ' ' + title + ' ' + cls)) {
            return true;
        }

        // 2. Chặn nút đóng công cụ gửi (khi menu radial đang mở)
        if (cls.includes('w-send-btn--close') || /đóng công cụ|close/i.test(aria + ' ' + title)) {
            return true;
        }

        // 3. Chặn hoàn toàn nút chỉnh cỡ chữ tin nhắn
        if (cls.includes('font-size') || cls.includes('zoom') || /cỡ chữ|thu nhỏ|phóng to/i.test(aria + ' ' + title)) {
            return true;
        }

        // 4. Chặn các tab tiện ích và nút không liên quan
        if (/^(text|math|feedback|sửa công thức|keys|làm bài|ảnh|sao chép|copy|âm thanh|sound|loa)$/i.test(txt)) {
            return true;
        }

        // 5. Chặn các tác vụ phụ trong radial menu
        if (/^(yêu cầu khác|hỏi kiến thức|gợi ý|nói dễ hiểu|giải thích kỹ)$/i.test(txt)) {
            return true;
        }
        if (/yêu cầu khác|hỏi kiến thức|nói dễ hiểu|giải thích kỹ/i.test(aria + ' ' + title)) {
            return true;
        }

        return false;
    }

    function openRadialMenuIfNeeded() {
        try {
            const submitDirect = document.querySelector('button[data-intent="SUBMIT_ANSWER"], [data-intent="SUBMIT_ANSWER"]');
            if (submitDirect && submitDirect.offsetParent !== null) return;
            const visibleItems = Array.from(document.querySelectorAll('.exercise-intent-radial__item, [class*="radial__item"]')).filter(el => !isInternalUi(el) && el.offsetParent !== null);
            if (visibleItems.length > 0) return;
            const trigger = document.querySelector('button.w-send-btn:not(.w-send-btn--close), .exercise-intent-radial__trigger, [class*="radial__trigger"], [class*="intent-radial"] > button, .radial-trigger');
            if (trigger && !isInternalUi(trigger) && trigger.offsetParent !== null) {
                console.log('[Auto Chat] Mở radial menu để hiện nút nộp bài...');
                trigger.click();
            }
        } catch (_) {}
    }

    function triggerClick(el) {
        if (!el) return false;
        try {
            el.focus();
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            el.click();
            return true;
        } catch (_) {
            try { el.click(); return true; } catch (_) { return false; }
        }
    }

    function dispatchEnter(target) {
        if (!target) return;
        try {
            target.focus();
            const eventProps = {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                charCode: 13,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window
            };
            target.dispatchEvent(new KeyboardEvent('keydown', eventProps));
            target.dispatchEvent(new KeyboardEvent('keypress', eventProps));
            target.dispatchEvent(new KeyboardEvent('keyup', eventProps));
        } catch (_) {}
    }

    function findEduNextSubmitButton(ta) {
        // 1. ƯU TIÊN 1 TUYỆT ĐỐI: Nút chính thức của EduNext có data-intent="SUBMIT_ANSWER"
        const intentBtn = document.querySelector('button[data-intent="SUBMIT_ANSWER"], [data-intent="SUBMIT_ANSWER"]');
        if (intentBtn && !isForbiddenButton(intentBtn) && intentBtn.offsetParent !== null) {
            const ariaPressed = intentBtn.getAttribute('aria-pressed');
            const isLoading = intentBtn.classList.contains('is-loading') || intentBtn.classList.contains('loading') || intentBtn.hasAttribute('disabled');
            if (ariaPressed === 'true' || isLoading) {
                console.warn('[Auto Chat] Nút nộp bài đang ở trạng thái active/pressed/loading, không click lặp lại.');
                return null;
            }
            return intentBtn;
        }

        // 2. ƯU TIÊN 2: Nút "Nộp câu trả lời" trong Radial Menu
        const radialCandidates = Array.from(document.querySelectorAll('.exercise-intent-radial__item, [class*="radial__item"], [class*="intent-radial"] [role="button"], [class*="intent-radial"] button, [class*="radial"] [role="button"], [class*="radial"] button'));
        for (const item of radialCandidates) {
            if (isForbiddenButton(item)) continue;
            if (item.disabled || item.offsetParent === null) continue;
            const label = [item.innerText, item.textContent, item.getAttribute('aria-label'), item.getAttribute('title')].filter(Boolean).join(' ').trim();
            if (/nộp\s*(?:câu\s*trả\s*lời|bài)?|submit(?:\s*answer)?/i.test(label)) {
                return item;
            }
        }

        // 2. ƯU TIÊN 2: Nút .w-send-btn chính thức của EduNext (khi không ở trạng thái đóng)
        const wSendBtn = document.querySelector('button.w-send-btn:not(.w-send-btn--close), .w-send-btn:not(.w-send-btn--close)');
        if (wSendBtn && !isForbiddenButton(wSendBtn) && !wSendBtn.disabled && wSendBtn.offsetParent !== null) {
            return wSendBtn;
        }

        // 3. ƯU TIÊN 3: Bất kỳ button mang nhãn "Nộp câu trả lời", "Nộp bài", hoặc "Gửi tin nhắn"
        const clickables = Array.from(document.querySelectorAll('button, [role="button"]')).filter(el => {
            if (isForbiddenButton(el)) return false;
            if (el.disabled || el.offsetParent === null) return false;
            const txt = (el.innerText || el.textContent || '').trim();
            const aria = (el.getAttribute('aria-label') || '').trim();
            const title = (el.getAttribute('title') || '').trim();
            return /^(?:nộp\s+câu\s+trả\s+lời|nộp\s+bài|submit\s+answer)$/i.test(txt) ||
                   /nộp\s+câu\s+trả\s+lời|nộp\s+bài/i.test(aria) ||
                   /nộp\s+câu\s+trả\s+lời|nộp\s+bài/i.test(title) ||
                   /gửi\s+tin\s+nhắn/i.test(aria + ' ' + title);
        });
        if (clickables.length > 0) return clickables[0];

        // 4. ƯU TIÊN 4: Nút mang nhãn gửi rõ ràng trong khu vực composer
        const footer = document.querySelector('.chat-footer, [class*="chat-footer"], [class*="footer"], [class*="chat_footer"], [class*="chatFooter"], .chat-composer');
        if (footer && !isInternalUi(footer)) {
            const btns = Array.from(footer.querySelectorAll('button, [role="button"]')).filter(b => {
                if (isForbiddenButton(b)) return false;
                if (b.disabled || b.offsetParent === null) return false;
                const label = [b.innerText, b.getAttribute('aria-label'), b.getAttribute('title')].filter(Boolean).join(' ').trim();
                return /gửi|send|submit|nộp/i.test(label);
            });
            if (btns.length > 0) return btns[0];
        }

        return null;
    }

    const findComposerSendButton = findEduNextSubmitButton;

    async function submitComposer() {
        if (isSubmitting) {
            console.warn('[Auto Chat] Đang trong tiến trình nộp bài, bỏ qua lệnh submit trùng.');
            return false;
        }
        const now = Date.now();
        if (now < rateLimitCooldownUntil) {
            const waitSec = Math.ceil((rateLimitCooldownUntil - now) / 1000);
            console.warn(`[Auto Chat] Đang chờ giãn cách 429 Rate Limit (còn ${waitSec}s)...`);
            if (typeof showToast === 'function') showToast(`⏳ Giãn cách 429 Rate Limit (chờ ${waitSec}s)`, 'warn', 2500);
            return false;
        }
        if (now - lastSubmitTimestamp < 10000) {
            console.warn('[Auto Chat] Bỏ qua submit trùng: Vừa nộp cách đây ít hơn 10 giây.');
            return false;
        }

        ensureEditorInEditMode();
        const ta = resolveSelector('textarea');

        // BẢO VỆ ĐỊNH DẠNG TRƯỚC KHI BẤM GỬI:
        // Nếu trong ô nhập hiện tại chỉ có "8" hoặc đáp án cụt mà câu hỏi yêu cầu "Trả lời: [đáp án của bạn]",
        // TỰ ĐỘNG BỔ SUNG "Trả lời: " NGAY TẠI Ô NHẬP!
        if (ta && ta.value) {
            const curVal = ta.value.trim();
            const latestMsg = getLatestAIMessage() || '';
            if (hasTemplateRequirement(latestMsg) && !/^\s*(?:tr[aả]\s*l[oờ]i|answer|tl)\s*:/i.test(curVal)) {
                console.log('[Auto Chat] Phát hiện ô nhập thiếu "Trả lời:", tự động sửa thành: "Trả lời: ' + curVal + '"');
                setInputValueNative(ta, 'Trả lời: ' + curVal);
                await new Promise(r => setTimeout(r, 150));
            }
            // Nếu giá trị này vừa được nộp chưa quá 25s -> Không gửi lặp
            if (lastSubmittedText && ta.value.trim() === lastSubmittedText.trim() && (now - lastSubmitTimestamp < 25000)) {
                console.warn('[Auto Chat] Bỏ qua submit: Nội dung trong ô nhập y hệt đáp án vừa gửi, đang chờ chấm.');
                return false;
            }
        }

        isSubmitting = true;
        try {
            // 1. Mở radial menu nếu đang đóng để nút "Nộp câu trả lời" xuất hiện
            openRadialMenuIfNeeded();
            await new Promise(r => setTimeout(r, 150));

            let sendBtn = findEduNextSubmitButton(ta);
            let submitted = false;
            if (sendBtn) {
                const btnName = (sendBtn.innerText || sendBtn.getAttribute('aria-label') || 'Nộp câu trả lời').trim();
                console.log('[Auto Chat] Kích hoạt nút nộp bài:', btnName, sendBtn);
                logActivity('submit', `Bấm nút: "${btnName}"`);
                submitted = triggerClick(sendBtn);
                lastSubmitTimestamp = Date.now();
                if (ta && ta.value) lastSubmittedText = ta.value.trim();
                await new Promise(r => setTimeout(r, 500));
            } else if (ta) {
                // CHỈ DISPATCH ENTER KHI KHÔNG TÌM THẤY NÚT GỬI (chống gửi trùng 2 lần đồng thời gây 429)
                console.log('[Auto Chat] Không tìm thấy nút nộp bài -> Dispatch Enter vào ô nhập');
                logActivity('submit', 'Nhấn Enter vào ô soạn thảo');
                dispatchEnter(ta);
                submitted = true;
                lastSubmitTimestamp = Date.now();
                if (ta && ta.value) lastSubmittedText = ta.value.trim();
                await new Promise(r => setTimeout(r, 500));
            }
            return submitted;
        } finally {
            // Khóa submit tối thiểu 8 giây để server EduNext phản hồi
            setTimeout(() => { isSubmitting = false; }, 8000);
        }
    }

    function findSubmitButton() { return findComposerSendButton(resolveSelector('textarea')) || resolveSelector('submitBtn'); }
    function pressEnter() { return submitComposer(); }
    async function clickSubmit() { return await submitComposer(); }
    function waitForResponse(baselineHash) {
        const speed = getSpeed();
        return new Promise(resolve => { const start = Date.now(); const tc = () => { const cur = getLatestHash(); if (cur && cur !== baselineHash) { resolve(true); return; } if (Date.now() - start >= speed.WAIT_RESPONSE_MAX) { resolve(false); return; } setTimeout(tc, speed.WAIT_RESPONSE_INTERVAL); }; tc(); });
    }
    function waitForReadyAck(baselineHash, maxWaitMs) {
        if (!maxWaitMs || maxWaitMs <= 0) maxWaitMs = 5000;
        return new Promise(resolve => { const start = Date.now(); const tc = () => { const cur = getLatestHash(); if (cur && cur !== baselineHash) { resolve(true); return; } if (Date.now() - start >= maxWaitMs) { resolve(false); return; } setTimeout(tc, 500); }; tc(); });
    }
    function waitBeforeSendDelay() {
        const ms = computeWaitBeforeSendMs(); if (ms <= 0) return Promise.resolve(false);
        return new Promise(resolve => { const start = Date.now(); const tick = () => { if (!isRunning) { resolve(true); return; } if (Date.now() - start >= ms) { resolve(false); return; } setTimeout(tick, Math.min(500, ms - (Date.now() - start))); }; tick(); });
    }
    function justOneMoreDelay(ms) {
        if (ms <= 0) return Promise.resolve(false);
        return new Promise(resolve => { const start = Date.now(); const tick = () => { if (!isRunning) { resolve(true); return; } if (Date.now() - start >= ms) { resolve(false); return; } setTimeout(tick, Math.min(500, ms - (Date.now() - start))); }; tick(); });
    }

    // ============================================================
    // MAIN LOOP
    // ============================================================
    let isRunning = false;
    let isProcessing = false;
    let lastProcessedHash = '';
    let processingStartTime = 0;
    let lastReadyClickTime = 0;

    function checkProcessingTimeout() {
        if (isProcessing && processingStartTime > 0) {
            const elapsed = Date.now() - processingStartTime;
            const waitMax = getWaitBeforeSend().max;
            const autoTypeExtra = getAutoType().mode === 'off' ? 0 : AUTO_TYPE_MAX_DURATION_MS;
            const recheckExtra = getRecheck().maxPasses * 15000;
            const fr = getFailRetry();
            const failRetryExtra = fr.maxAttempts === 0 ? 0 : (fr.maxAttempts >= 999 ? 300000 : fr.maxAttempts * 20000);
            const jomExtra = getJustOneMore().waitMs;
            const rp = getReadyAutoEnter();
            const readyRetryExtra = (rp.maxAttempts + 1) * (rp.checkDelay || 5000);
            const vnRetryExtra = 60000;
            const em = isEnsembleOn() ? 1.5 : 1;
            const limit = (getSpeed().PROCESSING_TIMEOUT + waitMax + autoTypeExtra + recheckExtra + failRetryExtra + jomExtra + readyRetryExtra + vnRetryExtra) * em;
            if (elapsed > limit) { isProcessing = false; processingStartTime = 0; }
        }
    }

    function stopAutoChat(reason) {
        if (!isRunning) return;
        isRunning = false; isProcessing = false; processingStartTime = 0;
        stopPersistentVisionShare();
        stopDomHealthMonitor();
        const btn = document.getElementById('auto-chat-btn');
        if (btn) { btn.dataset.state = 'done'; btn.classList.remove('ac-on'); btn.textContent = (isAutoSubmitOn() ? 'Auto: ' : 'Draft: ') + 'DONE'; btn.style.background = '#d97706'; }
        setStatus('done');
        logActivity('done', 'Đã hoàn thành bài học');
        showToast('✅ Đã hoàn thành bài học', 'success', 5000);
    }
    function pauseAutoChat(reason) {
        if (!isRunning) return;
        isRunning = false; isProcessing = false; processingStartTime = 0;
        stopDomHealthMonitor();
        const btn = document.getElementById('auto-chat-btn');
        if (btn) { btn.dataset.state = 'done'; btn.classList.remove('ac-on'); btn.textContent = (isAutoSubmitOn() ? 'Auto: ' : 'Draft: ') + 'PAUSED'; btn.style.background = '#d97706'; }
        setStatus('failed');
        logActivity('warn', `Paused: ${reason}`);
        showToast(`⏸️ ${reason}`, 'warn', 8000, true);
    }
    function toggleAutoChat() {
        const btn = document.getElementById('auto-chat-btn'); if (!btn) return;
        if (btn.dataset.state === 'done') {
            isRunning = true; isProcessing = false; processingStartTime = 0;
            lastProcessedHash = '';
            lastHandledQuestionIdentity = '';
            lastSubmittedText = '';
            lastSubmitTimestamp = 0;
            rateLimitCooldownUntil = 0;
            btn.dataset.state = 'on'; btn.classList.add('ac-on'); btn.textContent = (isAutoSubmitOn() ? 'Auto: ' : 'Draft: ') + 'ON'; btn.style.background = '#059669';
            setStatus('idle'); logActivity('info', 'Bật lại'); showToast('Bật lại', 'info', 2500);
            startDomHealthMonitor();
            setTimeout(runAutoChat, 500); return;
        }
        isRunning = !isRunning;
        btn.classList.toggle('ac-on', isRunning);
        btn.textContent = isRunning ? (isAutoSubmitOn() ? 'Auto: ON' : 'Draft: ON') : (isAutoSubmitOn() ? 'Auto: OFF' : 'Draft: OFF');
        btn.style.background = isRunning ? '#059669' : '#334155';
        btn.dataset.state = isRunning ? 'on' : 'off';
        if (isRunning) {
            isProcessing = false; processingStartTime = 0; lastProcessedHash = '';
            lastHandledQuestionIdentity = '';
            lastSubmittedText = '';
            lastSubmitTimestamp = 0;
            rateLimitCooldownUntil = 0;
            setStatus('idle'); logActivity('info', 'Đã bật Auto Chat'); showToast('Đã bật Auto', 'success', 2000);
            startDomHealthMonitor();
            // Nếu chưa có luồng chia sẻ màn hình -> Tự động kích hoạt để chụp ảnh các câu hỏi liên tục
            if (!visionScreenStream && typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
                captureScreenForVision().catch(() => {});
            }
            setTimeout(runAutoChat, 500);
        } else {
            setStatus('idle'); logActivity('info', 'Đã tắt'); showToast('Đã tắt', 'info', 2000);
            isProcessing = false; processingStartTime = 0;
            stopDomHealthMonitor();
            if (visionScreenStream) { stopPersistentVisionShare(); logActivity('info', 'Đã dừng chia sẻ màn hình'); }
        }
    }

        // ============================================================
    // XỬ LÝ HỘP "LÀM RÕ Ý ĐỊNH" (CLARIFY INTENT)
    // ============================================================
    async function handleClarifyIntentBox() {
        try {
            // Tìm nút xác nhận lựa chọn
            const allButtons = Array.from(document.querySelectorAll('button, [role="button"], a, div'));
            const confirmBtn = allButtons.find(el => {
                if (isInternalUi(el)) return false;
                const t = (el.innerText || el.textContent || '').trim();
                return /xác nhận lựa chọn|xác nhận mục/i.test(t);
            });

            // Tìm vùng chứa thông báo "LÀM RÕ Ý ĐỊNH" hoặc "Bạn muốn tiếp tục thế nào?"
            const clarifyContainer = Array.from(document.querySelectorAll('div, section, article, form')).find(el => {
                if (isInternalUi(el)) return false;
                const t = (el.innerText || el.textContent || '').trim();
                return t.includes('LÀM RÕ Ý ĐỊNH') || t.includes('Bạn muốn tiếp tục thế nào?') || t.includes('Chọn một mục bên dưới');
            });

            if (!confirmBtn && !clarifyContainer) return false;

            const scope = clarifyContainer || (confirmBtn ? confirmBtn.closest('div[class*="message"], div[class*="content"], div, section') : document.body);

            // Tìm các lựa chọn (01 Tiếp tục sang phần sau, 02 Hỏi lý thuyết, 03 Giải thích đơn giản hơn...)
            let optionElements = Array.from(scope.querySelectorAll('input[type="radio"], input[type="checkbox"], label, [role="radio"], [role="checkbox"]')).filter(el => {
                if (isInternalUi(el)) return false;
                if (confirmBtn && (el === confirmBtn || confirmBtn.contains(el))) return false;
                return el.offsetParent !== null;
            });

            if (!optionElements.length) {
                optionElements = Array.from(scope.querySelectorAll('div, button, li, p, span')).filter(el => {
                    if (isInternalUi(el)) return false;
                    if (confirmBtn && (el === confirmBtn || confirmBtn.contains(el))) return false;
                    const txt = (el.innerText || el.textContent || '').trim();
                    return /^(?:0?[1-3]\b|tiếp tục sang phần sau|hỏi lý thuyết|giải thích đơn giản hơn)/i.test(txt) && el.offsetParent !== null;
                });
            }

            const validOptions = optionElements.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 20 && rect.height > 15;
            });
            const targets = validOptions.length ? validOptions : optionElements;

            if (targets.length > 0) {
                // Chọn random 1 trong 3 mục theo đúng yêu cầu
                const picked = targets[Math.floor(Math.random() * targets.length)];
                const optName = (picked.innerText || picked.value || 'Lựa chọn').trim().replace(/\s+/g, ' ');
                console.log(`[Auto Chat] Phát hiện hộp LÀM RÕ Ý ĐỊNH -> Chọn ngẫu nhiên mục: "${optName}"`);
                logActivity('info', `Chọn mục làm rõ ý định: "${optName.substring(0, 35)}"`);

                picked.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                picked.focus?.();
                picked.click?.();
                picked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                picked.dispatchEvent(new Event('change', { bubbles: true }));

                await new Promise(r => setTimeout(r, 400));
            }

            // Bấm nút "Xác nhận lựa chọn"
            const btn = confirmBtn || Array.from(document.querySelectorAll('button, [role="button"], a, div')).find(el => {
                if (isInternalUi(el)) return false;
                const t = (el.innerText || el.textContent || '').trim();
                return /xác nhận lựa chọn/i.test(t);
            });

            if (btn) {
                console.log('[Auto Chat] Kích hoạt nút "Xác nhận lựa chọn"');
                logActivity('submit', 'Bấm nút "Xác nhận lựa chọn"');
                btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                btn.focus?.();
                btn.click?.();
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                showToast('✅ Đã chọn và xác nhận mục tiếp tục', 'success', 2500);
                await new Promise(r => setTimeout(r, 1000));
                return true;
            }
        } catch (e) {
            console.error('[Auto Chat] Lỗi xử lý hộp làm rõ ý định:', e);
        }
        return false;
    }

    let lastHandledTeacherBadge = null;
    let lastVisionShotTime = 0;

    async function runAutoChat() {
        checkProcessingTimeout();
        if (isProcessing || isSubmitting || !isRunning) return;

        const now = Date.now();
        if (now < rateLimitCooldownUntil) {
            setStatus('waiting');
            return;
        }
        if (now - lastSubmitTimestamp < 6000) {
            setStatus('waiting');
            return;
        }

        // BƯỚC 1: KIỂM TRA HỘP "LÀM RÕ Ý ĐỊNH" TRƯỚC HẾT
        const clarified = await handleClarifyIntentBox();
        if (clarified) {
            setStatus('waiting');
            return;
        }

        // BƯỚC 2: NẾU BẬT VISION SCREEN STREAM -> QUÉT ẢNH MỖI 5 GIÂY ĐỂ GIẢI LIÊN TỤC
        const hasLiveVision = visionScreenStream && visionScreenStream.getVideoTracks().some(t => t.readyState === 'live');
        if (hasLiveVision) {
            // Giữ nhịp đúng 5 giây một lần chụp ảnh
            if (now - lastVisionShotTime < 4500) {
                return;
            }
            if (now - lastSubmitTimestamp < 6000) {
                // Vừa nộp chưa quá 6s, đợi màn hình EduNext chuyển
                setStatus('waiting');
                return;
            }
            lastVisionShotTime = now;

            isProcessing = true;
            processingStartTime = Date.now();
            try {
                setStatus('thinking');
                const shot = await capturePersistentVisionFrame();
                pendingManualVisionImages = shot.images || [shot.image];

                const chat = getLatestChatState();
                const latestText = chat.text || '';
                logActivity('image', `Quét ảnh màn hình 5s (${shot.width}×${shot.height})`);

                const visionPrompt = [
                    'Dùng ảnh màn hình mới nhất để nhận diện và giải quyết bài tập trên EduNext.',
                    latestText ? `NỘI DUNG VĂN BẢN TRÊN KHUNG CHAT:\n${latestText}` : '',
                    'QUY TẮC BẮT BUỘC:',
                    '1. Nếu ảnh cho thấy buổi học ĐÃ KẾT THÚC hoặc có lời chúc mừng hoàn thành bài học, CHỈ XUẤT ĐÚNG MÃ: __LESSON_COMPLETE__',
                    '2. Nếu ảnh có câu hỏi xác nhận "Bạn đã sẵn sàng chuyển sang phần tiếp theo chưa?", CHỈ XUẤT ĐÚNG: Sẵn sàng',
                    '3. Nếu ảnh có CÂU HỎI / BÀI TẬP MỚI cần học sinh trả lời (bài tập hóa học, vật lý, toán, tiếng Anh, trắc nghiệm hoặc tự luận điền vào ô trống):',
                    '   - Hãy giải câu hỏi đó và xuất ĐÚNG ĐÁP ÁN theo định dạng trong ảnh.',
                    '   - Trả lời ngắn gọn, trực tiếp theo mẫu đề, không giải thích dài dòng.',
                    '   - Tuyệt đối KHÔNG trả lời "Sẵn sàng" khi có câu hỏi bài tập.',
                    '4. Nếu ảnh KHÔNG CÓ CÂU HỎI MỚI cần trả lời (chỉ là màn hình chờ, đang phân tích, bài giảng lý thuyết đang đọc, hoặc câu trả lời vừa gửi đang chờ chấm), CHỈ XUẤT ĐÚNG MÃ: __NO_QUESTION__',
                    '5. Nếu đề bài trong ảnh có yêu cầu mẫu trả lời (như "Trả lời: [đáp án]"), hãy xuất đúng mẫu: Trả lời: <kết quả>.'
                ].filter(Boolean).join('\n\n');

                const answer = await askAIWithFailRetry(visionPrompt, false, false, false, false, true);
                pendingManualVisionImages = [];

                if (!answer || answer.startsWith('❌')) {
                    logActivity('failed', answer || 'Không phân tích được ảnh');
                    setStatus('idle');
                    return;
                }

                // 2.1. Đã hoàn thành toàn bộ bài học
                if (/_{0,2}\s*LESSON_COMPLETE\s*_{0,2}/i.test(answer)) {
                    stopAutoChat('Đã hoàn thành toàn bộ bài học (xác nhận qua hình ảnh)!');
                    return;
                }

                // 2.2. Chưa có câu hỏi mới
                if (/_{0,2}\s*NO_QUESTION\s*_{0,2}/i.test(answer)) {
                    logActivity('info', 'Chưa có câu hỏi mới; tiếp tục quét sau 5s...');
                    setStatus('idle');
                    return;
                }

                // 2.3. Bỏ qua nếu đáp án này vừa nộp xong (tránh spam lặp)
                const normAns = normalizeAnswerForVote(answer);
                const normLast = normalizeAnswerForVote(lastSubmittedText);
                if (normAns && normAns === normLast && (Date.now() - lastSubmitTimestamp < 25000)) {
                    logActivity('info', 'Đáp án khớp câu vừa nộp, đang chờ bài chấm...');
                    setStatus('waiting');
                    return;
                }

                // 2.4. Điền và nộp đáp án ngay lập tức
                if (hasTemplateRequirement(latestText) && !/^\s*(?:trả\s*lời|tra\s*loi|tl)\s*:/i.test(answer)) {
                    answer = 'Trả lời: ' + answer.trim();
                }
                logActivity('answer', `Đáp án từ ảnh: ${answer.substring(0, 180)}`);
                const drafted = await deliverAnswer(Date.now(), answer, false, '');
                if (drafted) {
                    lastSubmittedText = answer;
                    lastSubmitTimestamp = Date.now();
                    setStatus('waiting');
                    showToast('📤 Đã giải và gửi đáp án từ ảnh', 'success', 2500);
                    return;
                }
            } catch (visionErr) {
                console.error('[Auto Chat] Lỗi Vision 5s:', visionErr);
                logActivity('warn', `Lỗi quét ảnh: ${visionErr.message}`);
            } finally {
                isProcessing = false;
                processingStartTime = 0;
            }
            return;
        }

        // BƯỚC 3: DỰ PHÒNG TEXT DOM STATE MACHINE NẾU CHƯA BẬT VISION STREAM
        const chat = getLatestChatState();
        if (chat.state === 'waiting_teacher') {
            setStatus('waiting');
            return;
        }
        if (chat.state !== 'student_turn' || !chat.text) {
            return;
        }
        if (isTransientStatusMessage(chat.text)) {
            setStatus('waiting');
            return;
        }

        // ĐỊNH DANH CÂU HỎI BẰNG HASH NỘI DUNG VĂN BẢN (KHÔNG DÙNG OBJECT REFERENCE)
        const currentQId = getQuestionIdentity(chat.text) || ('q_' + hashMessage(chat.text));
        if (currentQId && currentQId === lastHandledQuestionIdentity) {
            // Câu hỏi này đã được xử lý và nộp, đang đợi giáo viên chấm hoặc ra câu mới
            setStatus('waiting');
            return;
        }

        // Chống gửi trùng nếu vừa nộp chưa quá 10s
        if (lastSubmittedText && (Date.now() - lastSubmitTimestamp < 10000)) {
            setStatus('waiting');
            return;
        }

        isProcessing = true;
        processingStartTime = Date.now();
        try {
            const latest = chat.text;
            const cleanedLatest = sanitizeUiChrome(latest);

            if (isLessonEnded(cleanedLatest)) {
                lastHandledQuestionIdentity = currentQId;
                lastHandledTeacherBadge = chat.teacherBadge;
                stopAutoChat('Đã hoàn thành toàn bộ bài học!');
                return;
            }

            const hasExercise = isExercise(latest) || /câu hỏi|bài sau|hãy làm|trả lời|đáp án|orbital|electron|nguyên tử|phương trình|\?/i.test(latest);
            const isReadyPrompt = !hasExercise && (/bạn đã sẵn sàng|sẵn sàng chuyển sang|are you ready|ready to move on|sẵn sàng chưa/i.test(latest) || !!findReadyQuickReply());

            if (isReadyPrompt) {
                const rt = /ready/i.test(latest) ? 'Ready' : 'Sẵn sàng';
                logActivity('info', `Chuyển chặng -> Tự động gửi "${rt}"`);
                const quickBtn = findReadyQuickReply();
                await handleReadyState(rt, quickBtn);
                lastHandledQuestionIdentity = currentQId;
                lastHandledTeacherBadge = chat.teacherBadge;
                lastSubmittedText = rt;
                lastSubmitTimestamp = Date.now();
                await new Promise(r => setTimeout(r, 1200));
                return;
            }

            setStatus('thinking');
            logActivity('question', `Câu hỏi: ${latest.substring(0, 150).replace(/\n/g, ' ')}...`);

            const answer = await askAIWithFailRetry(latest, false, false, false, false, true);
            if (answer && !answer.startsWith('❌')) {
                logActivity('answer', `Đáp án: ${answer.substring(0, 200).replace(/\n/g, ' ')}`);
                const drafted = await deliverAnswer(currentQId, answer, false, '');
                if (drafted) {
                    lastHandledQuestionIdentity = currentQId;
                    lastHandledTeacherBadge = chat.teacherBadge;
                    lastSubmittedText = answer;
                    lastSubmitTimestamp = Date.now();
                    isAwaitingNextQuestion = true;
                }
            } else {
                logActivity('failed', answer || 'Không có đáp án từ AI; sẽ tự động thử lại ở chu kỳ tiếp theo');
            }
        } catch (err) {
            console.error('[Auto Chat] Lỗi xử lý DOM:', err);
        } finally {
            isProcessing = false;
            processingStartTime = 0;
        }
    }

    // ============================================================
    // ACTIVITY PANEL CREATE
    // ============================================================
    function createActivityPanel() {
        if (document.getElementById('ac-activity-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'ac-activity-panel';
        panel.className = 'ac-root ac-activity-hidden';
        panel.innerHTML = `<div class="ac-act-header"><div class="ac-act-title">📺 <span>Live Activity</span> <span class="ac-act-count" id="ac-act-count">0</span></div><div class="ac-act-actions"><button class="ac-act-btn" id="ac-act-clear" title="Xóa">🗑️</button><button class="ac-act-btn" id="ac-act-close" title="Đóng">✕</button></div></div><div class="ac-act-feed" id="ac-activity-feed"></div>`;
        document.body.appendChild(panel);
        document.getElementById('ac-act-close').addEventListener('click', () => toggleActivityPanel(false));
        document.getElementById('ac-act-clear').addEventListener('click', () => clearActivityLog());
        document.getElementById('ac-activity-feed').addEventListener('click', e => { const en = e.target.closest('.ac-act-entry'); if (!en) return; const idx = parseInt(en.dataset.activityIdx, 10); if (!Number.isNaN(idx)) showActivityDetail(idx); });
    }

    // ============================================================
    // BUTTONS
    // ============================================================
    function toggleButtonsVisibility() {
        buttonsHidden = !buttonsHidden;
        const bar = document.getElementById('ac-button-bar'); if (bar) bar.classList.toggle('ac-hidden', buttonsHidden);
        const chip = document.getElementById('ac-status-chip'); if (chip) chip.classList.toggle('ac-chip-hidden', buttonsHidden);
        const cred = document.getElementById('ac-credit-badge'); if (cred) cred.classList.toggle('ac-chip-hidden', buttonsHidden);
        if (buttonsHidden) {
            const p = document.getElementById('ac-activity-panel'); if (p) p.classList.add('ac-activity-hidden');
            const tc = document.getElementById('ac-toast-container'); if (tc) tc.innerHTML = '';
        } else {
            showToast('Đã hiện', 'info', 1500);
        }
    }
    function createButtons() {
        if (document.getElementById('auto-chat-btn')) return;
        const bar = document.createElement('div');
        bar.id = 'ac-button-bar';
        bar.className = 'ac-root';
        const makeBtn = (id, text, bg, onclick, title) => { const b = document.createElement('button'); b.id = id; b.textContent = text; if (title) b.title = title; b.style.background = bg; if (onclick) b.addEventListener('click', e => { e.stopPropagation(); onclick(e); }); bar.appendChild(b); return b; };
        const btn = makeBtn('auto-chat-btn', isAutoSubmitOn() ? 'Auto: OFF' : 'Draft: OFF', '#334155', null, isAutoSubmitOn() ? 'Tự động giải và gửi câu trả lời' : 'Tự điền bản nháp; không tự gửi'); btn.dataset.state = 'off';
        btn.addEventListener('click', e => { e.stopPropagation(); toggleAutoChat(); });
        makeBtn('groq-key-btn', '🔑 Keys', '#6366f1', () => showKeyManagerDialog(), 'API Keys & Live Model List');
        makeBtn('vision-image-btn', '📷 Ảnh', '#0891b2', () => chooseVisionScreenshot(), 'Chọn ảnh chụp câu hỏi để gửi cho model có hỗ trợ vision');
        makeBtn('screen-capture-btn', '⚡ Làm bài', '#0f766e', () => captureScreenForVision(), 'Chụp màn hình, hỏi AI và điền bản nháp; bạn tự xem rồi gửi');
        makeBtn('settings-btn', '⚙️', '#0ea5e9', () => showSettingsDialog(), 'Cài đặt');
        makeBtn('summary-btn', '📋', '#16a34a', () => showSummaryDialog(), 'Tóm tắt / Study Notes / Inspector');
        makeBtn('stats-btn', '📊', '#8b5cf6', () => showStatsDialog(), 'Stats');
        makeBtn('cache-btn', '💾', '#f59e0b', () => showCacheManagerDialog(), 'Cache');
        makeBtn('activity-btn', '📺', '#06b6d4', () => toggleActivityPanel(), 'Activity Panel (Ctrl+Shift+A)');
        makeBtn('tutorial-btn', '📖', '#eab308', () => showTutorialDialog(), 'Hướng dẫn sử dụng');
        makeBtn('changelog-btn', '📜', '#7c3aed', () => showChangelogDialog(), 'Lịch sử');
        makeBtn('hide-toggle-btn', '🙈', '#64748b', () => toggleButtonsVisibility(), 'Ẩn/hiện (ẩn = tắt mọi popup)');
        document.body.appendChild(bar);
        updateChangelogBadge();
        const chip = document.createElement('div');
        chip.id = 'ac-status-chip'; chip.className = 'ac-root';
        chip.title = 'Auto Chat: Idle';
        chip.innerHTML = '<span id="ac-status-icon">💤</span>';
        chip.style.color = '#94a3b8';
        chip.addEventListener('click', () => showStatsDialog());
        document.body.appendChild(chip);
        const cred = document.createElement('div');
        cred.id = 'ac-credit-badge'; cred.className = 'ac-root';
        cred.title = 'Credit: ' + CREDIT_TEXT;
        cred.innerHTML = '<span>✨</span><span>' + escapeHtml(CREDIT_TEXT) + '</span>';
        document.body.appendChild(cred);
        document.addEventListener('keydown', e => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            const isEd = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
            const hk = SETTINGS.hideKeybind || ''; const ak = SETTINGS.autoChatKeybind || '';
            if (hk && matchesKeybind(e, hk)) { const hm = /ctrl|alt|shift|meta/i.test(hk); if (isEd && !hm) return; e.preventDefault(); toggleButtonsVisibility(); return; }
            if (ak && matchesKeybind(e, ak)) { const hm = /ctrl|alt|shift|meta/i.test(ak); if (isEd && !hm) return; e.preventDefault(); toggleAutoChat(); return; }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); toggleActivityPanel(); }
        });
    }

    // ============================================================
    // OBSERVER + INIT
    // ============================================================
    let observerTimer = null;
    let intervalId = null;
    const observer = new MutationObserver(() => {
        if (!isRunning || isProcessing || isSubmitting) return;
        if (Date.now() < rateLimitCooldownUntil) return;
        if (Date.now() - lastSubmitTimestamp < 8000) return;
        if (observerTimer) clearTimeout(observerTimer);
        observerTimer = setTimeout(() => { observerTimer = null; runAutoChat(); }, Math.max(1200, getSpeed().OBSERVER_DEBOUNCE));
    });
    function restartInterval() {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        const speed = getSpeed();
        const intervalMs = Math.min(speed.INTERVAL_CHECK, 2500);
        intervalId = setInterval(() => { checkProcessingTimeout(); if (isRunning) runAutoChat(); }, intervalMs);
    }

    function init() {
        injectStyles();
        createButtons();
        createActivityPanel();
        toggleActivityPanel(SETTINGS.activityPanelOpen === 'on');
        setTimeout(() => { const r = cachePrune(); if (r > 0) logActivity('info', `Pruned ${r} cache entries`); }, 100);
        setTimeout(() => {
            observer.observe(document.body, { childList: true, subtree: true });
            restartInterval();
            const activeKey = getActiveKey();
            const provider = activeKey ? PROVIDERS[activeKey.provider] : null;
            console.log(`[Auto Chat v${CURRENT_VERSION}] Ready. | Credit: ${CREDIT_TEXT}`);
            console.log(`[Auto Chat v${CURRENT_VERSION}] Active:`, activeKey ? `${provider?.label} / ${activeKey.model}${provider?.supportsVision ? ' (👁️)' : ''}` : '(none)');
            console.log(`[Auto Chat v${CURRENT_VERSION}] Self-healing: ${SETTINGS.selfHealingEnabled === 'on' ? 'ON' : 'OFF'} · DOM Health: ${SETTINGS.domHealthEnabled === 'on' ? 'ON' : 'OFF'}`);
            console.log(`[Auto Chat v${CURRENT_VERSION}] Subject detection: ${SETTINGS.subjectDetection === 'on' ? 'ON' : 'OFF'}`);
            console.log(`[Auto Chat v${CURRENT_VERSION}] Variation: fingerprint=${SETTINGS.behavioralFingerprint}, jitter=${SETTINGS.responseTimeJitter}`);
            logActivity(canvasCaptureAvailable ? 'info' : 'warn', canvasCaptureAvailable ? 'Canvas text/image tracking active' : 'Không cài được canvas hook sớm; dùng nút 📷 Ảnh nếu nội dung chỉ nằm trong canvas');
            if (!activeKey) console.warn('[Auto Chat] ⚠️ Không có key hợp lệ (model rỗng hoặc chưa thêm key). Vào 🔑 để cấu hình.');
            logActivity('info', `Auto Chat v${CURRENT_VERSION} ready`);
            logActivity('info', `Active: ${activeKey ? activeKey.model : '(no key)'}`);
        }, 2000);
        if (isFreeModelsAutoRefreshOn()) {
            setTimeout(() => {
                refreshFreeModelsCache(false).then(c => {
                    if (c) {
                        const totalModels = Object.values(c.data).reduce((s, d) => s + (d.models?.length || 0), 0);
                        const freeCount = Object.values(c.data).reduce((s, d) => s + (d.models?.filter(m => m.tier === 'free').length || 0), 0);
                        logActivity('free', `Live Model List: ${totalModels} models (${freeCount} FREE)`);
                    }
                });
            }, 4000);
        }
        if (!SETTINGS.lastSeenVersion) { SETTINGS.lastSeenVersion = CURRENT_VERSION; saveSettings(SETTINGS); }
        else updateChangelogBadge();

        const openKeyFlow = () => {
            if (!getActiveKey()) {
                if ((SETTINGS.keys || []).length === 0) showAddKeyDialog();
                else showKeyManagerDialog();
            }
        };

        const tutorialDone = SETTINGS.tutorialSeen === 'on';
        if (!tutorialDone) {
            // Lần đầu mở: hiện hướng dẫn TRƯỚC, khi đóng/skip → tự động mở form thêm key
            setTimeout(() => {
                showTutorialDialog(() => {
                    SETTINGS.tutorialSeen = 'on';
                    saveSettings(SETTINGS);
                    setTimeout(openKeyFlow, 300);
                });
            }, 800);
        } else {
            setTimeout(openKeyFlow, 1000);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
