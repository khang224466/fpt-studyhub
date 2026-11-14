function e(e, serverOrigin) {
    try {
        var t = "v10.2.64";
        if (window.__ENX_PRO_HUD__ && window.__ENX_VERSION__ === t) {
            var n = document.getElementById("enx-pro-hud");
            if (n) return void (n.style.display = "none" === n.style.display ? "block" : "none");
        }
        try {
            var i = document.getElementById("enx-pro-hud");
            i && (i.dispatchEvent(new CustomEvent("enx_destroy")), i.remove());
        } catch ($) {}
        window.__ENX_PRO_HUD__ = !0, window.__ENX_VERSION__ = t;
        var apiOrigin = serverOrigin || 'https://fpt-studyhub.vercel.app';
        var ENX_SALT = "ENX_SEC_2026_FLASH_LITE";
        var DEFAULT_TOKEN = "FPT1.eyJvcmRlcklkIjoiT1JELTg4ODctU0VNRVNURVItVklQIiwiZXhwaXJlc0F0IjoxODA0OTkwODg4NTE0LCJwbGFuIjoiMSBL4buzIEjhu41jICg0IFRow6FuZykiLCJub25jZSI6InNlZWQtdmlwLTIwMjYifQ.eaIyaxIoNHGg5Xv1lGJueKphjp1UHa8kE8cPmQdn3LE";

        var submittedHistory = [];
        function isDuplicateSubmission(candidate) {
            if (!candidate || typeof candidate !== 'string') return false;
            var norm = candidate.toLowerCase().replace(/^(?:trả\s*lời|đáp\s*án|answer)\s*:\s*/i, '').replace(/[.,!?;:'"()[\]{}]/g, '').replace(/\s+/g, ' ').trim();
            if (norm.length < 3) return false;
            return submittedHistory.some(function(prev) {
                var pNorm = prev.toLowerCase().replace(/^(?:trả\s*lời|đáp\s*án|answer)\s*:\s*/i, '').replace(/[.,!?;:'"()[\]{}]/g, '').replace(/\s+/g, ' ').trim();
                return norm === pNorm || (norm.length > 20 && (pNorm.includes(norm) || norm.includes(pNorm)));
            });
        }

        function parseWaitSeconds(str) {
            if (!str) return 35;
            var match = str.match(/after\s*(\d+)\s*seconds/i) || str.match(/(\d+)\s*(?:seconds|giây)/i);
            if (match) return Math.min(600, parseInt(match[1], 10) + 3);
            return 35;
        }

        function isRevoked(token) {
            if (!token) return false;
            try {
                var rawRevoked = localStorage.getItem("fpt_admin_deleted_orders_v10") || localStorage.getItem("fpt_revoked_keys_v10") || "[]";
                var list = JSON.parse(rawRevoked);
                if (Array.isArray(list) && list.some(function(item) { return item && (token === item || token.includes(item) || item.includes(token)); })) {
                    return true;
                }
            } catch (_) {}
            return false;
        }

        function o(token) {
            if (!token || typeof token !== "string") return { valid: false, reason: "Chưa có Key bản quyền" };
            var cur = token.trim();
            if (isRevoked(cur)) {
                return { valid: false, expired: true, reason: "Key bản quyền đã bị xóa / vô hiệu hóa vĩnh viễn bởi Quản trị viên!" };
            }
            if (cur.startsWith("AIza") || cur.startsWith("AQ.")) {
                return { valid: true, expired: false, key: cur, plan: "Lifetime", expDate: "Vĩnh viễn", remDays: 999 };
            }
            if (cur.startsWith("FPT1.")) {
                try {
                    var encoded = cur.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
                    var claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), function(c) { return c.charCodeAt(0); })));
                    if (claims.orderId && isRevoked(claims.orderId)) {
                        return { valid: false, expired: true, reason: "Đơn hàng và Key đã bị xóa bởi Quản trị viên!" };
                    }
                    if (!Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= Date.now()) throw new Error("License đã hết hạn.");
                    return { valid: true, expired: false, key: cur, plan: claims.plan || "VIP", expDate: new Date(claims.expiresAt).toLocaleString("vi-VN"), remDays: Math.ceil((claims.expiresAt - Date.now()) / 864e5) };
                } catch (err) { return { valid: false, reason: err.message }; }
            }
            if (cur.startsWith("ENC_AI_")) {
                try {
                    var b64 = cur.slice(7);
                    var hex = atob(b64);
                    var out = "";
                    for (var s = 0; s < hex.length; s += 2) {
                        var c = parseInt(hex.substr(s, 2), 16) ^ ENX_SALT.charCodeAt((s / 2) % ENX_SALT.length);
                        out += String.fromCharCode(c);
                    }
                    if (out && out.startsWith("EXP|")) {
                        var parts = out.split("|");
                        var expMs = parseInt(parts[1], 10);
                        var plan = parts[2] || "VIP";
                        var rawGeminiKey = parts.slice(3).join("|");
                        var now = Date.now();
                        if (isNaN(expMs)) return { valid: false, reason: "Lỗi timestamp thời hạn" };
                        var expStr = new Date(expMs).toLocaleDateString("vi-VN") + " " + new Date(expMs).toLocaleTimeString("vi-VN");
                        if (now > expMs) {
                            try { localStorage.removeItem("enx_encrypted_ai_key"); localStorage.removeItem("enx_license_key"); } catch (_) {}
                            return { valid: false, expired: true, plan: plan, expDate: expStr, reason: "Key gói " + plan + " đã hết hạn vào " + expStr + "!" };
                        }
                        var finalKey = (rawGeminiKey && (rawGeminiKey.startsWith("AIza") || rawGeminiKey.startsWith("AQ."))) ? rawGeminiKey.trim() : atob("QVEuQWI4Uk42STBzeHlnOEV3aHZDSmlzMkdOQVZEMUcyUVBMNXZYU3pkeWR6dGgtOWVwZw==");
                        var cleanPlan = plan;
                        if (/[\x00-\x1f\x7f-\xff]/.test(cleanPlan) || cleanPlan.includes("CFŨh") || cleanPlan.includes("CFÜh") || cleanPlan.length > 35) {
                            cleanPlan = "1 Kỳ Học (4 Tháng)";
                        } else if (cleanPlan === "1 Ky Hoc (4 Thang)") {
                            cleanPlan = "1 Kỳ Học (4 Tháng)";
                        } else if (cleanPlan === "1 Thang") {
                            cleanPlan = "1 Tháng";
                        } else if (cleanPlan === "1 Tuan") {
                            cleanPlan = "1 Tuần";
                        }
                        return { valid: true, expired: false, key: finalKey, encKey: cur, plan: cleanPlan, expDate: expStr, remDays: Math.ceil((expMs - now) / 864e5) };
                    }
                    if (out && (out.startsWith("AIza") || out.startsWith("AQ.") || out.length >= 20)) {
                        return { valid: true, expired: false, key: out.trim(), encKey: cur, plan: "VIP", expDate: "Vĩnh viễn", remDays: 999 };
                    }
                    return { valid: false, reason: "Nội dung key không hợp lệ" };
                } catch (err) {
                    return { valid: false, reason: "Lỗi giải mã key: " + (err.message || err) };
                }
            }
            return { valid: false, reason: "Key không đúng định dạng bản quyền (FPT1...)" };
        }

        var a = (e || "").trim();
        if (!a) {
            try {
                a = (localStorage.getItem("enx_encrypted_ai_key") || localStorage.getItem("enx_license_key") || "").trim();
            } catch (_) {}
        }
        var validation = a ? o(a) : { valid: false };
        if (a && !validation.valid) {
            // Key was entered or saved, but is invalid / expired / deleted -> DO NOT fall back!
            try {
                localStorage.removeItem("enx_encrypted_ai_key");
                localStorage.removeItem("enx_license_key");
            } catch (_) {}
        } else if (!a) {
            a = DEFAULT_TOKEN;
        }
        if (a && (a.startsWith("FPT1.") || a.startsWith("ENC_AI_")) && o(a).valid) {
            try {
                localStorage.setItem("enx_encrypted_ai_key", a);
                localStorage.setItem("enx_license_key", a);
            } catch (_) {}
        }
        var s = false, c = 0, l = '', u = '', d = true, h = 0, m = null, g = null, f = null, remaining = 35;
        function updateCountdownUI() {
            var autoBtn = document.getElementById("hud-auto-btn");
            var cdBadge = document.getElementById("enx-cd-badge");
            if (d) {
                if (autoBtn && autoBtn.textContent !== "✅ Hoàn thành") {
                    autoBtn.textContent = "⚡ Auto: " + remaining + "s";
                }
                if (cdBadge && cdBadge.textContent !== "✅") {
                    cdBadge.textContent = remaining + "s";
                    cdBadge.style.background = "#fbbf24";
                    cdBadge.style.color = "#000";
                }
            } else {
                if (autoBtn && autoBtn.textContent !== "✅ Hoàn thành") {
                    autoBtn.textContent = "⏸ Auto: TẮT";
                }
                if (cdBadge && cdBadge.textContent !== "✅") {
                    cdBadge.textContent = "TẮT";
                    cdBadge.style.background = "#64748b";
                    cdBadge.style.color = "#fff";
                }
            }
        }
        function x() {
            return f && !f.closed ? (f.focus(), P("info", "Cầu Nối AI Bridge đang hoạt động!"), 
            f) : (f = window.open(apiOrigin + "/bridge.html", "enx_bridge_win", "width=480,height=540,menubar=no,toolbar=no,location=no"), 
            P("success", "✓ Đã mở Cầu Nối AI Bridge (Vượt CSP 100%)!"), f);
        }
        !function() {
            try {
                function parseWaitSeconds(str) {
                    if (!str || typeof str !== 'string') return 35;
                    var m = str.match(/after\s*(\d+)\s*seconds/i) || str.match(/(\d+)\s*giây/i) || str.match(/retry\s*in\s*(\d+)/i);
                    return m ? Math.min(600, parseInt(m[1], 10) + 5) : 35;
                }
                if (window.fetch && !window.__enx_fetch_hooked) {
                    var e = window.fetch;
                    window.fetch = async function(...t) {
                        try {
                            var n = await e.apply(this, t);
                            if (n && 429 === n.status) {
                                var waitSec = 35;
                                try {
                                    var clone = n.clone();
                                    var bodyText = await clone.text();
                                    waitSec = parseWaitSeconds(bodyText);
                                } catch (_) {}
                                h = Date.now() + (waitSec * 1000);
                                remaining = waitSec;
                                updateCountdownUI();
                                P("warn", "EduNext 429 Too Many Requests -> Tự động hoãn " + waitSec + "s bảo vệ nick");
                            }
                            return n;
                        } catch (n) {
                            throw n;
                        }
                    }, window.__enx_fetch_hooked = !0;
                }
                if (window.XMLHttpRequest && !window.__enx_xhr_hooked) {
                    var t = XMLHttpRequest.prototype.send;
                    XMLHttpRequest.prototype.send = function(...e) {
                        return this.addEventListener("load", (function() {
                            if (429 === this.status) {
                                var waitSec = parseWaitSeconds(this.responseText || "");
                                h = Date.now() + (waitSec * 1000);
                                remaining = waitSec;
                                updateCountdownUI();
                                P("warn", "EduNext 429 Too Many Requests (XHR) -> Tự động hoãn " + waitSec + "s");
                            }
                        })), t.apply(this, e);
                    }, window.__enx_xhr_hooked = !0;
                }
            } catch (e) {}
        }();
        var b = document.createElement("div");
        b.id = "enx-pro-hud", b.style.cssText = 'position:fixed;top:70px;right:25px;z-index:2147483647;width:370px;background:rgba(11,15,25,0.98);border:2px solid #10b981;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.85),0 0 25px rgba(16,185,129,0.35);padding:14px;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;backdrop-filter:blur(16px);font-size:12px;box-sizing:border-box;transition:opacity 0.2s;';
        var y = !1, v = 0, w = 0, _ = 0, T = 0, C = document.createElement("div");
        C.style.cssText = "display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:8px;margin-bottom:10px;cursor:move;user-select:none;", 
        C.onmousedown = function(e) {
            if ("BUTTON" !== e.target.tagName && "A" !== e.target.tagName) {
                y = !0, v = e.clientX, w = e.clientY;
                var t = b.getBoundingClientRect();
                _ = t.left, T = t.top, window.addEventListener("mousemove", n), window.addEventListener("mouseup", (function e() {
                    y = !1, window.removeEventListener("mousemove", n), window.removeEventListener("mouseup", e);
                }));
            }
            function n(e) {
                if (y) {
                    var t = e.clientX - v, n = e.clientY - w;
                    b.style.bottom = "auto", b.style.right = "auto", b.style.left = Math.max(10, Math.min(window.innerWidth - 380, _ + t)) + "px", 
                    b.style.top = Math.max(10, Math.min(window.innerHeight - 100, T + n)) + "px";
                }
            }
        };
        var E = document.createElement("div");
        E.style.cssText = "display:flex;align-items:center;gap:8px;";
        var N = document.createElement("div");
        N.style.cssText = "width:28px;height:28px;border-radius:8px;background:#10b981;display:flex;align-items:center;justify-content:center;color:#000;font-weight:900;font-size:14px;", 
        N.textContent = "⚡", E.appendChild(N);
        var k = document.createElement("div"), S = document.createElement("div");
        S.style.cssText = "font-weight:800;font-size:13px;color:#fff;display:flex;align-items:center;gap:6px;", 
        S.textContent = "EduNext AI Pro ";
        var A = document.createElement("span");
        A.style.cssText = "font-size:10px;background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.4);padding:1px 5px;border-radius:4px;", 
        A.textContent = t, S.appendChild(A);
        var I = document.createElement("div");
        I.style.cssText = "font-size:10px;color:#10b981;font-weight:600;display:flex;align-items:center;gap:6px;", I.innerHTML = 'Auto Loop 35s <span id="enx-cd-badge" style="background:#fbbf24;color:#000;padding:1px 6px;border-radius:4px;font-weight:800;font-size:10px;">35s</span>', 
        k.appendChild(S), k.appendChild(I), E.appendChild(k), C.appendChild(E);
        var M = document.createElement("div");
        M.style.cssText = "display:flex;align-items:center;gap:4px;";
        var H = document.createElement("button");
        H.style.cssText = "background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:2px 4px;line-height:1;", 
        H.textContent = "─", H.title = "Thu nhỏ / Mở rộng", H.onclick = function() {
            q.style.display = "none" === q.style.display ? "block" : "none";
        }, M.appendChild(H);
        var B = document.createElement("button");
        B.style.cssText = "background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:2px 6px;line-height:1;", 
        B.textContent = "✕", B.onclick = function() {
            try {
                b.dispatchEvent(new CustomEvent("enx_destroy"));
            } catch (e) {}
            m && m.getTracks().forEach((function(e) {
                e.stop();
            })), b.remove(), window.__ENX_PRO_HUD__ = !1, window.__ENX_VERSION__ = null;
        }, M.appendChild(B), C.appendChild(M), b.appendChild(C);
        var q = document.createElement("div");
        function O() {
            for (;q.firstChild; ) q.removeChild(q.firstChild);
            var e = !(!m || !m.getVideoTracks().some((function(e) {
                return "live" === e.readyState;
            }))), n = o(a), i = n.valid && !n.expired, r = "function" == typeof GM_xmlhttpRequest || "undefined" != typeof window && "function" == typeof window.__ENX_GM_XHR__ || "undefined" != typeof unsafeWindow && "function" == typeof unsafeWindow.__ENX_GM_XHR__;
            if (!r) {
                var s = document.createElement("div");
                s.style.cssText = "background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:8px 10px;margin-bottom:8px;";
                var c = document.createElement("div");
                c.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;";
                var l = document.createElement("span");
                l.style.cssText = "font-weight:700;color:#34d399;font-size:10px;", l.textContent = "⚡ CHẾ ĐỘ BOOKMARKLET 100%", 
                c.appendChild(l);
                var u = document.createElement("span"), h = f && !f.closed;
                u.style.cssText = h ? "color:#10b981;font-weight:700;font-size:10px;" : "color:#f59e0b;font-weight:700;font-size:10px;", 
                u.textContent = h ? "✓ Đã mở Cầu Nối" : "⚠️ Cần mở Cầu Nối AI", c.appendChild(u), 
                s.appendChild(c);
                var p = document.createElement("div");
                p.style.cssText = "font-size:9.5px;color:#cbd5e1;margin-bottom:6px;line-height:1.3;", 
                p.textContent = "Bấm nút dưới để mở Cầu Nối AI vượt CSP Cloudflare (Không cần cài đặt script).", 
                s.appendChild(p);
                var g = document.createElement("button");
                g.style.cssText = "width:100%;background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;font-weight:800;font-size:10px;padding:6px;border-radius:6px;cursor:pointer;", 
                g.textContent = "🌐 BẤM ĐÂY ĐỂ MỞ CẦU NỐI AI (VƯỢT CSP NGAY)", g.onclick = function() {
                    x(), O();
                }, s.appendChild(g), q.appendChild(s);
            }
            if (!e) {
                var b = document.createElement("div");
                b.style.cssText = "background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:8px 10px;margin-bottom:8px;text-align:center;";
                var y = document.createElement("div");
                y.style.cssText = "font-size:10px;color:#fca5a5;font-weight:700;margin-bottom:6px;", 
                y.textContent = "📷 CẦN CHIA SẺ MÀN HÌNH ĐỂ BOT TỰ ĐỘNG CHỤP & GIẢI BÀI!", b.appendChild(y);
                var v = document.createElement("button");
                v.style.cssText = "width:100%;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;color:#fff;font-weight:900;font-size:11px;padding:8px;border-radius:6px;cursor:pointer;animation:pulse 2s infinite;", 
                v.textContent = "👉 BẤM ĐÂY ĐỂ BẬT CHIA SẺ MÀN HÌNH (TAB EDUNEXT)", v.onclick = function() {
                    R();
                }, b.appendChild(v), q.appendChild(b);
            }
            var w = document.createElement("div");
            w.style.cssText = "background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px 10px;margin-bottom:8px;";
            var _ = document.createElement("div");
            _.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
            var T = document.createElement("div");
            T.style.cssText = "display:flex;align-items:center;gap:6px;";
            var C = document.createElement("span");
            C.textContent = i ? "🔑" : n.expired ? "⛔" : "⚠️", T.appendChild(C);
            var E = document.createElement("span");
            E.style.cssText = i ? "color:#34d399;font-weight:700;" : n.expired ? "color:#ef4444;font-weight:700;" : "color:#f59e0b;font-weight:700;", 
            E.textContent = i ? "Bản Quyền: " + (n.plan || "VIP") : n.expired ? "Bản Quyền: Đã Hết Hạn" : "Bản Quyền: Chưa Kích Hoạt", 
            T.appendChild(E), _.appendChild(T);
            var N = document.createElement("span");
            i ? (N.style.cssText = "font-size:9.5px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);border:1px solid #10b981;color:#34d399;font-weight:700;", 
            N.textContent = "ĐÃ KÍCH HOẠT") : n.expired ? (N.style.cssText = "font-size:9.5px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.15);border:1px solid #ef4444;color:#f87171;font-weight:700;", 
            N.textContent = "ĐÃ TỰ HỦY") : (N.style.cssText = "font-size:9.5px;padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.15);border:1px solid #f59e0b;color:#fbbf24;font-weight:700;", 
            N.textContent = "CHƯA KÍCH HOẠT"), _.appendChild(N), w.appendChild(_);
            var k = document.createElement("div");
            k.style.cssText = "font-size:10px;color:#94a3b8;margin-top:4px;line-height:1.3;padding-left:20px;", 
            i ? k.textContent = "Thời hạn: Còn " + (n.remDays || 0) + " ngày (Hết hạn: " + (n.expDate || "") + ")" : n.expired ? (k.style.color = "#fca5a5", 
            k.textContent = "Key đã tự động hủy. Vui lòng liên hệ Admin Discord để gia hạn.") : k.textContent = "Kéo nút Bookmarklet từ website fpt-studyhub sau khi Admin duyệt đơn.", 
            w.appendChild(k), q.appendChild(w);
            var S = document.createElement("div");
            S.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:6px 10px;margin-bottom:8px;";
            var A = document.createElement("div");
            A.style.cssText = "display:flex;align-items:center;gap:6px;";
            var I = document.createElement("span");
            I.style.cssText = e ? "color:#10b981;" : "color:#ef4444;", I.textContent = "●", 
            A.appendChild(I);
            var M = document.createElement("span");
            M.style.cssText = e ? "color:#10b981;font-weight:700;" : "color:#94a3b8;", M.textContent = e ? "Màn Hình: Đang kết nối (Auto Vision)" : "Màn Hình: Chưa bật", 
            A.appendChild(M), S.appendChild(A);
            var H = document.createElement("button");
            H.style.cssText = e ? "background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#fca5a5;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;" : "background:rgba(16,185,129,0.2);border:1px solid #10b981;color:#34d399;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;", 
            H.textContent = e ? "Ngắt Kết Nối" : "📷 Chia Sẻ Màn Hình", H.onclick = function() {
                R();
            }, S.appendChild(H), q.appendChild(S);
            var B = document.createElement("div");
            B.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
            var L = document.createElement("button");
            L.style.cssText = "flex:1;background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:800;font-size:11px;padding:9px 12px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 12px rgba(16,185,129,0.3);", 
            L.textContent = "🎯 Chụp & Giải Câu Này Ngay", L.onclick = function() {
                remaining = 35; updateCountdownUI();
                var t = K();
                if (t.allowed) return void Q(!0, !0);
                alert("⛔ " + t.reason);
            }, B.appendChild(L);
            var G = document.createElement("button");
            G.id = "hud-auto-btn", G.style.cssText = "background:rgba(16,185,129,0.2);border:1px solid #10b981;color:#34d399;font-weight:700;font-size:11px;padding:9px 12px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:4px;min-width:110px;justify-content:center;white-space:nowrap;", 
            G.textContent = d ? "⚡ Auto: 35s" : "⏸ Auto: TẮT", G.onclick = function() {
                d = !d;
                if (d) {
                    remaining = 35;
                    G.style.background = "rgba(16,185,129,0.2)";
                    G.style.borderColor = "#10b981";
                    G.style.color = "#34d399";
                    P("info", "Chế độ tự động liên tục: BẬT (Chu kỳ 35s)");
                    updateCountdownUI();
                    Q(!0, !1);
                } else {
                    G.style.background = "rgba(100,116,139,0.2)";
                    G.style.borderColor = "#64748b";
                    G.style.color = "#94a3b8";
                    P("info", "Chế độ tự động liên tục: TẮT");
                    updateCountdownUI();
                }
            }, B.appendChild(G), q.appendChild(B);
            var D = document.createElement("div");
            D.id = "hud-status-text", D.style.cssText = "font-size:11px;color:#38bdf8;margin-bottom:6px;min-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;", 
            D.textContent = e ? "● Auto Loop đang chạy: Tự động chụp & giải bài..." : "⚠️ Chờ cấp quyền chia sẻ màn hình...", 
            q.appendChild(D);
            var X = document.createElement("div");
            X.id = "hud-logs-box", X.style.cssText = "background:#020617;border:1px solid #1e293b;border-radius:8px;height:95px;overflow-y:auto;padding:6px 8px;font-family:monospace;font-size:10px;line-height:1.45;color:#94a3b8;", 
            q.appendChild(X), P("success", "EduNext AI Pro " + t + " sẵn sàng!"), r ? P("success", "✓ Đã kích hoạt Tampermonkey Bypass CSP 100%") : P("info", "Chế độ Bookmarklet 100% (Sử dụng song song Cầu Nối AI)"), 
            i ? P("info", "Key hợp lệ: " + (n.plan || "VIP") + " (Sẵn sàng giải bài 100%)") : P("warn", "Chưa có Key bản quyền hợp lệ (" + (n.reason || "Cần nạp key") + ")");
        }
        function P(e, t) {
            var n = document.getElementById("hud-logs-box");
            if (n) {
                var i = document.createElement("div");
                i.style.color = "warn" === e ? "#f59e0b" : "err" === e ? "#ef4444" : "success" === e ? "#10b981" : "#94a3b8";
                var r = (new Date).toLocaleTimeString("vi-VN");
                i.textContent = "[" + r + "] " + t, n.appendChild(i), n.scrollTop = n.scrollHeight;
            }
        }
        function L(e, t) {
            var n = document.getElementById("hud-status-text");
            n && (n.textContent = e, t && (n.style.color = t));
        }
        async function R() {
            if (m) return m.getTracks().forEach((function(e) {
                e.stop();
            })), m = null, g = null, O(), void P("info", "Đã dừng chia sẻ màn hình.");
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return void alert("Trình duyệt không hỗ trợ Screen Capture API");
                P("info", "Đang yêu cầu quyền chia sẻ màn hình...");
                var e = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: 1,
                        displaySurface: "browser"
                    },
                    audio: !1,
                    preferCurrentTab: !0
                }), t = document.createElement("video");
                t.muted = !0, t.playsInline = !0, t.srcObject = e, m = e, g = t;
                var n = e.getVideoTracks()[0];
                n && (n.onended = function() {
                    m = null, g = null, O(), P("warn", "Chia sẻ màn hình đã ngắt.");
                }), await t.play(), O(), P("success", "✓ Đã kích hoạt Auto Vision! Bot bắt đầu tự động giải liên tục!"), 
                Q(!0, !1); } catch (e) {
                P("warn", "Hủy chia sẻ màn hình: " + (e.message || e));
            }
        }
        function G(e) {
            return new Promise((function(t, n) {
                var i = ("function" == typeof GM_xmlhttpRequest ? GM_xmlhttpRequest : null) || ("undefined" != typeof window && "function" == typeof window.__ENX_GM_XHR__ ? window.__ENX_GM_XHR__ : null) || ("undefined" != typeof unsafeWindow && "function" == typeof unsafeWindow.__ENX_GM_XHR__ ? unsafeWindow.__ENX_GM_XHR__ : null) || ("undefined" != typeof GM && "function" == typeof GM.xmlHttpRequest ? GM.xmlHttpRequest : null);
                if (i) try {
                    return void i({
                        method: e.method || "GET",
                        url: e.url,
                        headers: e.headers || {},
                        data: e.body || null,
                        timeout: e.timeout || 8e3,
                        onload: function(e) {
                            try {
                                var n = JSON.parse(e.responseText);
                                t({
                                    ok: e.status >= 200 && e.status < 300,
                                    status: e.status,
                                    json: async function() {
                                        return n;
                                    },
                                    text: async function() {
                                        return e.responseText;
                                    }
                                });
                            } catch (n) {
                                t({
                                    ok: e.status >= 200 && e.status < 300,
                                    status: e.status,
                                    json: async function() {
                                        return {};
                                    },
                                    text: async function() {
                                        return e.responseText;
                                    }
                                });
                            }
                        },
                        onerror: function(e) {
                            n(new Error(e && e.error ? e.error : "Network Error"));
                        },
                        ontimeout: function() {
                            n(new Error("Request timeout"));
                        }
                    });
                } catch (e) {
                    console.warn("[GM_xmlhttpRequest Error]:", e);
                }
                fetch(e.url, {
                    method: e.method || "GET",
                    headers: e.headers || {},
                    body: e.body || void 0
                }).then(t).catch((function(e) {
                    n(new Error("EduNext CSP chặn mạng! Bạn đang chạy Bookmarklet. Vui lòng cài script vào Tampermonkey hoặc mở Cầu Nối AI để bypass CSP 100%!"));
                }));
            }));
        }
        function D(e, t) {
            for (var n = function(e) {
                if (!e) return null;
                for (var t in e) if (t.startsWith("__reactFiber$")) return e[t];
                return null;
            }(e), i = 0; n && i < 60; ) {
                if (n.memoizedProps && "function" == typeof n.memoizedProps[t]) return n.memoizedProps[t];
                if (n.pendingProps && "function" == typeof n.pendingProps[t]) return n.pendingProps[t];
                n = n.return, i++;
            }
            return null;
        }
        function X(e, t) {
            if (e) {
                e.focus();
                try {
                    var n = D(e, "onInputChange");
                    "function" == typeof n && n(t);
                } catch (e) {}
                try {
                    e.select(), document.execCommand("selectAll", !1, null), document.execCommand("insertText", !1, t);
                } catch (e) {}
                try {
                    var i = e._valueTracker;
                    i && i.setValue(e.value + "_diff");
                    var r = window.HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, o = Object.getOwnPropertyDescriptor(r, "value");
                    o && o.set ? o.set.call(e, t) : e.value = t;
                } catch (n) {
                    e.value = t;
                }
                try {
                    e.dispatchEvent(new Event("input", {
                        bubbles: !0,
                        composed: !0
                    })), e.dispatchEvent(new Event("change", {
                        bubbles: !0,
                        composed: !0
                    })), "undefined" != typeof InputEvent && e.dispatchEvent(new InputEvent("input", {
                        bubbles: !0,
                        composed: !0,
                        inputType: "insertText",
                        data: t
                    }));
                } catch (e) {}
                try {
                    var a = function(e) {
                        if (!e) return null;
                        for (var t in e) if (t.startsWith("__reactProps$") || t.startsWith("__reactEventHandlers$")) return e[t];
                        return null;
                    }(e);
                    a && "function" == typeof a.onChange && a.onChange({
                        target: {
                            value: t
                        },
                        currentTarget: {
                            value: t
                        }
                    });
                } catch (e) {}
            }
        }
        function U(e) {
            if (!e) return !1;
            try {
                e.focus && e.focus();
                try {
                    e.disabled = !1, e.removeAttribute("disabled");
                } catch (e) {}
                var t = {
                    bubbles: !0,
                    cancelable: !0,
                    view: window,
                    composed: !0
                };
                return e.dispatchEvent(new PointerEvent("pointerdown", t)), e.dispatchEvent(new MouseEvent("mousedown", t)), 
                e.dispatchEvent(new PointerEvent("pointerup", t)), e.dispatchEvent(new MouseEvent("mouseup", t)), 
                e.dispatchEvent(new MouseEvent("click", t)), "function" == typeof e.click && e.click(), 
                !0;
            } catch (e) {
                return !1;
            }
        }
        async function z(e) {
            var t = e.trim(), n = function() {
                for (var e = document.querySelectorAll('textarea.w-md-editor-text-input, .w-md-editor textarea, textarea, input[type="text"], div[contenteditable="true"]'), t = 0; t < e.length; t++) {
                    var n = e[t];
                    if (!n.closest("#enx-pro-hud") && null !== n.offsetParent) return n;
                }
                return null;
            }();
            if (!n) return P("warn", "Không tìm thấy ô nhập câu trả lời!"), !1;
            s = !0;
            try {
                L("✍️ Đang làm sạch ô nhập & điền đáp án mới...", "#38bdf8"), X(n, ""), await new Promise((function(e) {
                    setTimeout(e, 80);
                })), X(n, t), P("info", 'Đã gõ nội dung: "' + t.slice(0, 35) + '..."'), L("● Đang tìm và bấm nút Nộp câu trả lời...", "#10b981"), 
                await new Promise((function(e) {
                    setTimeout(e, 300);
                })), function() {
                    try {
                        var e = document.querySelector('button[data-intent="SUBMIT_ANSWER"], [data-intent="SUBMIT_ANSWER"]');
                        if (e && null !== e.offsetParent) return;
                        if (Array.from(document.querySelectorAll('.exercise-intent-radial__item, [class*="radial__item"]')).filter((function(e) {
                            return !e.closest("#enx-pro-hud") && null !== e.offsetParent;
                        })).length > 0) return;
                        var t = document.querySelector('button.w-send-btn:not(.w-send-btn--close), .exercise-intent-radial__trigger, [class*="radial__trigger"], [class*="intent-radial"] > button, .radial-trigger');
                        t && !t.closest("#enx-pro-hud") && null !== t.offsetParent && (P("info", "Mở menu nộp bài..."), 
                        t.click());
                    } catch (e) {}
                }(), await new Promise((function(e) {
                    setTimeout(e, 300);
                }));
                var i = !1, r = function(e) {
                    var t = [];
                    function n(e, n, i) {
                        e && (e.closest('#enx-pro-hud, .course-lesson-list, [class*="lesson-list"], aside:not(.w-chat-input__intent-panel), nav, .ant-layout-sider') || t.push({
                            el: e,
                            score: n,
                            reason: i
                        }));
                    }
                    for (var i = Array.from(document.querySelectorAll('button[data-intent="SUBMIT_ANSWER"], [data-intent="SUBMIT_ANSWER"]')), r = 0; r < i.length; r++) n(i[r], 100, "intent=SUBMIT_ANSWER");
                    for (var o = Array.from(document.querySelectorAll('.exercise-intent-column__item, .exercise-intent-radial__item, .exercise-intent-submit__button, [class*="exercise-intent"] button')), a = 0; a < o.length; a++) {
                        var s = o[a], c = (s.innerText || s.textContent || s.getAttribute("aria-label") || "").trim();
                        /nộp\s*(?:câu\s*trả\s*lời|đáp\s*án|bài)?|submit/i.test(c) && n(s, 95, "intent-item-submit");
                    }
                    for (var l = Array.from(document.querySelectorAll('button.w-send-btn:not(.w-send-btn--close), .w-send-btn:not(.w-send-btn--close), button[class*="w-send-btn"], button[aria-label*="Gửi tin nhắn"], button[aria-label*="Send message"]')), u = 0; u < l.length; u++) n(l[u], 90, "w-send-btn");
                    for (var d = Array.from(document.querySelectorAll('button, [role="button"], div, span, a, input[type="button"], input[type="submit"]')), h = 0; h < d.length; h++) {
                        var p = d[h];
                        if (!p.closest("#enx-pro-hud, .course-lesson-list, aside:not(.w-chat-input__intent-panel), nav, .ant-layout-sider") && !p.classList.contains("w-chat-input__submit-note") && !(p.innerText || "").includes("Enter là xuống hàng")) {
                            var m = (p.innerText || p.textContent || "").trim(), g = (p.getAttribute("aria-label") || "").trim(), f = (p.getAttribute("title") || "").trim();
                            /^(?:nộp\s+câu\s+trả\s+lời|nộp\s+đáp\s+án|nộp\s+bài|submit\s+answer)$/i.test(m) ? n("BUTTON" === p.tagName ? p : p.querySelector('button, [role="button"]') || p.closest('button, [role="button"]') || p, 85, "text=Nộp câu trả lời") : (/nộp\s+câu\s+trả\s+lời|nộp\s+đáp\s+án|nộp\s+bài/i.test(g) || /nộp\s+câu\s+trả\s+lời|nộp\s+đáp\s+án|nộp\s+bài/i.test(f)) && n("BUTTON" === p.tagName ? p : p.querySelector('button, [role="button"]') || p.closest('button, [role="button"]') || p, 80, "aria/title=Nộp câu trả lời");
                        }
                    }
                    if (e) {
                        var x = e.closest(".w-chat-input__composer-row, .w-chat-input__layout, .w-chat-input, .chat-footer") || e.parentElement;
                        if (x) for (var b = Array.from(x.querySelectorAll('button, [role="button"]')), y = 0; y < b.length; y++) {
                            var v = b[y];
                            if (!v.closest("#enx-pro-hud")) {
                                var w = (v.innerText || v.textContent || "").trim().toLowerCase();
                                "text" !== w && "math" !== w && "∑ math" !== w && "sigma" !== w && "b" !== w && "i" !== w && n(v, 70, "composer-button");
                            }
                        }
                    }
                    return t.length > 0 ? (t.sort((function(e, t) {
                        return t.score - e.score;
                    })), t[0].el) : null;
                }(n);
                if (r) {
                    var o = (r.innerText || r.textContent || r.getAttribute("aria-label") || "Nút Nộp").trim();
                    U(r) && (i = !0, c = Date.now(), l = t, P("success", "✓ ĐÃ BẤM [" + (o.slice(0, 25) || "Nộp câu trả lời") + "] thành công!"), 
                    L("✓ Đã nộp thành công! Chờ EduNext chấm bài...", "#34d399"));
                }
                try {
                    var a = D(n, "onSendMessage");
                    "function" == typeof a && (P("info", "✓ Kích hoạt onSendMessage trực tiếp từ EduNext React Fiber!"), 
                    a(t, t, {
                        resolved_intent: "SUBMIT_ANSWER"
                    }), i = !0, c = Date.now(), l = t, L("✓ Đã nộp qua React Fiber!", "#34d399"));
                } catch (e) {}
                return i || (function(e) {
                    if (e) {
                        var t = {
                            key: "Enter",
                            code: "Enter",
                            keyCode: 13,
                            which: 13,
                            bubbles: !0,
                            cancelable: !0
                        };
                        e.dispatchEvent(new KeyboardEvent("keydown", t)), e.dispatchEvent(new KeyboardEvent("keypress", t)), 
                        e.dispatchEvent(new KeyboardEvent("keyup", t));
                    }
                }(n), c = Date.now(), l = t, P("warn", "Không thấy nút nộp dạng click, đã gửi Enter bài làm!"), 
                L("● Đã gửi Enter bài làm.", "#38bdf8")), setTimeout((function() {
                    s = !1;
                }), 5e3), !0;
            } catch (e) {
                return s = !1, P("err", "Lỗi khi nộp bài: " + (e.message || e)), !1;
            }
        }
        function V() {
            var e = "", t = "", n = "";
            try {
                var i = ((document.title || "") + " " + ((document.querySelector('.breadcrumb, .ant-breadcrumb, h1, h2, .course-header, [class*="course"]') || {}).innerText || "")).match(/\b([A-Z]{3}\s*\d{3})\b/i);
                i && (t = i[1].toUpperCase().replace(/\s+/g, ""));
            } catch (e) {}
            try {
                var r = window.location.href.match(/courses?(?:\/detail)?\/([a-zA-Z0-9_-]+)/i);
                r && (e = r[1]);
            } catch (e) {}
            try {
                var o = document.querySelector('.course-name, .course-title, [class*="course-name"], [class*="CourseHeader"]');
                o && (n = (o.innerText || o.textContent || "").trim().replace(/\s+/g, " "));
            } catch (e) {}
            return {
                key: t || (e ? "ID_" + e : "EDUNEXT_ACTIVE_COURSE"),
                code: t,
                id: e,
                label: t || n || (e ? "Môn #" + e : "Môn học hiện tại")
            };
        }
        function W() {
            try {
                var e = localStorage.getItem("enx_course_quota_v10");
                if (e) return JSON.parse(e);
            } catch (e) {}
            return {
                courses: {},
                count: 0
            };
        }
        function K() {
            var e = V(), t = W(), n = t.courses[e.key], i = 6048e5, r = Date.now();
            if (n) {
                var s = (Array.isArray(n.completedSessions) ? n.completedSessions : n.completedAt ? [ n.completedAt ] : []).filter((function(e) {
                    return r - e < i;
                }));
                if (s.length >= 7) {
                    var c = Math.min.apply(null, s), l = i - (r - c), u = Math.ceil(l / 864e5), d = Math.ceil(l / 36e5);
                    return {
                        allowed: !1,
                        course: e,
                        reason: "Môn [" + e.label + "] đã làm đủ " + s.length + "/7 bài trong tuần này. Giới hạn bản quyền: 7 bài / tuần (vui lòng chờ " + (u > 1 ? u + " ngày" : d + " giờ") + ")."
                    };
                }
            }
            var h = 12, p = o(a); if (p.valid && p.plan && (p.plan.includes("1 Tuần") ? h = 6 : p.plan.includes("1 Tháng") ? h = 10 : p.plan.includes("Kỳ") && (h = 16)), !t.courses[e.key]) {
                var m = Object.keys(t.courses).length;
                if (m >= h) return {
                    allowed: !1,
                    course: e,
                    reason: "Đã đạt giới hạn số lượng môn của gói (" + m + "/" + h + " môn). Vui lòng liên hệ Discord Admin để mở rộng thêm môn."
                };
            }
            return {
                allowed: !0,
                course: e
            };
        }
        function j() {
            var e = V(), t = W(), n = Date.now();
            t.courses[e.key] || (t.courses[e.key] = {
                label: e.label,
                completedSessions: [],
                url: window.location.pathname
            });
            var i = t.courses[e.key], r = Array.isArray(i.completedSessions) ? i.completedSessions : i.completedAt ? [ i.completedAt ] : [];
            (r = r.filter((function(e) {
                return n - e < 6048e5;
            }))).push(n), i.completedSessions = r, i.completedAt = n, i.label = e.label, i.url = window.location.pathname, 
            t.count = Object.keys(t.courses).length, function(e) {
                try {
                    localStorage.setItem("enx_course_quota_v10", JSON.stringify(e));
                } catch (e) {}
            }(t), P("warn", "📌 Đã ghi nhận hoàn thành bài (" + r.length + "/7 bài tuần này) cho môn: " + e.label);
        }
        function F(e) {
            if (!e) return "";
            var t = e.replace(/\r\n/g, "\n"), n = t.search(/(?:câu\s*hỏi|question|bài\s*sau)\s*:/i);
            return -1 !== n && (t = t.slice(n)), (t = (t = (t = t.replace(/[0-9a-f]{20,}/gi, "")).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")).replace(/(?:Feedback|Sửa công thức(?:\s*\(\d+\))?|Đã chấm bằng AI|INT:\s*\w+)/gi, "")).trim();
        }
        async function solveOnServer(question, image) {
            var keyInfo = o(a);
            var rawGeminiKey = (keyInfo.valid && !keyInfo.expired && keyInfo.key) ? keyInfo.key : '';
            var payload = { licenseKey: a, question: question, images: image ? [image] : [] };

            // 1. Thử gọi trực tiếp Google Gemini Flash-Lite (Tốc độ ~1s)
            if (rawGeminiKey && (rawGeminiKey.startsWith('AIza') || rawGeminiKey.startsWith('AQ.'))) {
                try {
                    var parts = [];
                    if (image) {
                        var b64 = image.replace(/^data:image\/\w+;base64,/, '');
                        parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } });
                    }
                    parts.push({ text: question });
                    var candidateModels = ['gemini-flash-lite-latest', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
                    for (var mi = 0; mi < candidateModels.length; mi++) {
                        var mod = candidateModels[mi];
                        try {
                            var directRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + mod + ':generateContent?key=' + encodeURIComponent(rawGeminiKey), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ role: 'user', parts: parts }],
                                    generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
                                }),
                                signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(12000) : undefined
                            });
                            if (directRes.ok) {
                                var dj = await directRes.json();
                                var dt = dj.candidates && dj.candidates[0] && dj.candidates[0].content && dj.candidates[0].content.parts && dj.candidates[0].content.parts[0] ? dj.candidates[0].content.parts[0].text : '';
                                if (dt && dt.trim()) {
                                    P('success', '✓ Trực tiếp Google Gemini (' + mod + ') phản hồi thành công!');
                                    return dt.trim();
                                }
                            }
                        } catch(errDirect) {}
                    }
                } catch(_) {}
            }

            // 2. Thử Tampermonkey GM_xmlhttpRequest nếu có cài
            var gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : window.__ENX_GM_XHR__;
            if (typeof gm === 'function') {
                return new Promise(function(resolve) {
                    gm({ method: 'POST', url: apiOrigin + '/api/v1/ai/solve', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(payload), timeout: 25000,
                      onload: function(response) { try { var result = JSON.parse(response.responseText); if (response.status === 429) h = Date.now() + 30000; if (!result.success) P('warn', result.message || 'AI chưa sẵn sàng'); resolve(result.success ? result.answer : null); } catch (_) { resolve(null); } },
                      onerror: function() { resolve(null); }, ontimeout: function() { resolve(null); }
                    });
                });
            }

            // 3. Sử dụng Cầu Nối AI Bridge (Vượt CSP 100%)
            if (!f || f.closed) {
                x();
            }
            if (!f || f.closed) {
                P('warn', '⚠️ Cần bấm [Mở Cầu Nối AI] để cấp quyền vượt CSP cho Bookmarklet!');
                return null;
            }

            P('info', 'Đang gửi qua Cầu Nối AI Bridge...');
            return new Promise(function(resolve) {
                var requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
                var timer = setTimeout(function() {
                    window.removeEventListener('message', receive);
                    P('warn', 'Cầu Nối AI Bridge phản hồi quá hạn (timeout 25s)');
                    resolve(null);
                }, 25000);
                function receive(event) {
                    if (event.data && event.data.type === 'ENX_SOLVE_RES' && event.data.requestId === requestId) {
                        clearTimeout(timer);
                        window.removeEventListener('message', receive);
                        if (event.data.status === 429) h = Date.now() + 30000;
                        if (event.data.success && event.data.answer) {
                            P('success', '✓ Cầu Nối AI Bridge giải thành công!');
                            resolve(event.data.answer);
                        } else {
                            P('warn', 'Cầu Nối AI: ' + (event.data.error || 'AI chưa sẵn sàng'));
                            resolve(null);
                        }
                    }
                }
                window.addEventListener('message', receive);
                f.postMessage({
                    type: 'ENX_SOLVE_REQ',
                    requestId: requestId,
                    rawKey: a,
                    promptText: question,
                    imageBase64: image || null,
                    payload: payload
                }, '*');
            });
        }
        async function Q(e, isManual) {
            if ((d || e) && !s) {
                var t = K();
                if (t.allowed) {
                    var n = readEduNextTurn(document);

                    // IF 1: Check Dead-End Conversation or Long 429 (> 30s) -> Click [+ New] to start fresh session!
                    if (n.state === 'need_new_chat') {
                        P("warn", "⚡ Phát hiện phiên học cũ bị ngắt / nghẽn (429 dài). Tự động bấm [+ New] mở phiên mới ngay...");
                        L("⚡ Đang tự động bấm [+ New] mở phiên mới...", "#f59e0b");
                        var newChatBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(function(b) {
                            return !b.closest('#enx-pro-hud') && /(?:\+\s*New|Tạo\s*mới|New\s*Chat)/i.test((b.innerText || b.textContent || '').trim());
                        });
                        if (newChatBtn) {
                            try {
                                newChatBtn.click();
                                P("success", "✓ Đã bấm [+ New] mở phiên học mới thành công!");
                                h = 0; // Clear any old 429 cooldown
                            } catch (_) {}
                        } else {
                            // Fallback: If no [+ New] button, try [Try again] once
                            var tryAgainBtn = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(function(b) {
                                return !b.closest('#enx-pro-hud') && /try\s*again|thử\s*lại/i.test((b.innerText || b.textContent || '').trim());
                            });
                            if (tryAgainBtn && Date.now() - (window.__ENX_LAST_TRY_AGAIN__ || 0) > 30000) {
                                window.__ENX_LAST_TRY_AGAIN__ = Date.now();
                                try { tryAgainBtn.click(); P("success", "✓ Đã bấm [Try again] thử lại!"); } catch (_) {}
                            }
                        }
                        remaining = 5;
                        updateCountdownUI();
                        return;
                    }

                    // IF 2: Check Short 429 Rate Limit Cooldown (<= 30s)
                    if (n.state === 'rate_limited' || n.rateLimitSeconds > 0) {
                        var sWait = n.rateLimitSeconds + 3;
                        h = Math.max(h, Date.now() + (sWait * 1000));
                        var leftSec = Math.ceil((h - Date.now()) / 1e3);
                        L("⏳ Chờ hồi phục Rate Limit 429 (" + leftSec + "s)...", "#f59e0b");
                        remaining = leftSec;
                        updateCountdownUI();
                        return;
                    }

                    if (n.state === 'idle' && !e) return;

                    var activeInput = (function() {
                        for (var els = document.querySelectorAll('textarea.w-md-editor-text-input, .w-md-editor textarea, textarea, input[type="text"]'), idx = 0; idx < els.length; idx++) {
                            var el = els[idx];
                            if (!el.closest('#enx-pro-hud') && el.offsetParent !== null && !el.disabled && !el.readOnly) return el;
                        }
                        return null;
                    })();

                    // If active input is available and question text exists, it is ALWAYS student's turn
                    if (activeInput && n.state === 'waiting_teacher') {
                        n.state = 'student_turn';
                    }

                    if ("waiting_teacher" !== n.state || e) {
                        if (Date.now() < h) {
                            var leftSec = Math.ceil((h - Date.now()) / 1e3);
                            L("⏳ Chờ hồi phục Rate Limit 429 (" + leftSec + "s)...", "#f59e0b");
                            remaining = leftSec;
                            updateCountdownUI();
                            return;
                        } else if (Date.now() - c < 4e3 && !e) {
                            L("⏳ Chờ EduNext cập nhật sau khi nộp...", "#94a3b8");
                        } else {
                            var i = n.lastTeacherMsg || "";

                            // 1. Ready & Transition Check - STRICT ANTI-"YES" FIREWALL FOR EXERCISES
                            var hasActualExercise = (function() {
                                var combined = (n.questionBlockText || "") + " " + (n.fullTeacherMsg || "") + " " + (i || "");
                                if (/(?:câu\s*hỏi|question|bài\s*sau|đề\s*bài|exercise|please\s*try\s*the\s*exercise|write\s*your\s*answer|answer\s*:\s*\[|fill\s*in|choose\s*the|what\s+is|what\s+does|how\s+does|which\s+modal)/i.test(combined)) return true;
                                if (document.querySelector('.exercise-question-block, [class*="exercise-question"], [class*="question-content"], [class*="question-box"]')) return true;
                                return false;
                            })();

                            // Click quick-reply chip if teacher presented a single choice button (e.g. [Ready] / [Sẵn sàng]) AND no active text input
                            if (!hasActualExercise && !activeInput) {
                                var readyBtn = (function(studentAnchor) {
                                    try {
                                        var btns = Array.from(document.querySelectorAll('button, [role="button"], .quick-reply, .chat-chip, .suggestion-item, [class*="chip"], [class*="quick"], [class*="suggestion"], .quick-insert-btn'));
                                        for (var idx = 0; idx < btns.length; idx++) {
                                            var btn = btns[idx];
                                            if (!btn.closest('#enx-pro-hud') && !(btn.disabled || btn.offsetParent === null || studentAnchor && btn.compareDocumentPosition(studentAnchor) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                                                var btnText = (btn.innerText || btn.textContent || '').replace(/\s+/g, ' ').trim();
                                                if (/^(?:yes|ready|sẵn\s*sàng|i'm\s*ready|im\s*ready|ok|sure)[!.]?$/i.test(btnText)) return btn;
                                            }
                                        }
                                    } catch (_) {}
                                    return null;
                                })(n.lastStudentBadge);

                                if (readyBtn) {
                                    var btnText = (readyBtn.innerText || "").trim();
                                    P("info", "🎯 Bấm nút chuyển phần (" + btnText + ")...");
                                    L('🎯 Bấm nút "' + btnText + '" chuyển phần...', "#10b981");
                                    try { U(readyBtn); } catch (_) {}
                                    remaining = 5;
                                    updateCountdownUI();
                                    return void L("👀 Đang chờ câu hỏi tiếp theo hiện lên...", "#38bdf8");
                                }
                            }

                            // 2. Check Actual Lesson Completion (ONLY if NO active input box and NOT a question)
                            var isActuallyComplete = !activeInput && (function(msg) {
                                if (!msg) return false;
                                var t = msg.toLowerCase();
                                if (t.includes('?') || t.includes('are you ready') || t.includes('sẵn sàng') || t.includes('câu hỏi') || t.includes('question') || t.includes('trả lời:')) return false;
                                return /chúc\s*mừng\s*(?:em|bạn)?\s*hoàn\s*thành\s*buổi\s*học/i.test(msg) ||
                                       /điểm\s*buổi\s*học\s*:\s*\d+\s*\/\s*\d+/i.test(msg) ||
                                       /hẹn\s*gặp\s*(?:em|bạn).{0,30}buổi\s*học\s*tiếp\s*theo/i.test(msg) ||
                                       /congratulations.{0,80}(?:completed|finished).{0,60}(?:lesson|session|course)/i.test(msg);
                            })(i);

                            if (isActuallyComplete) {
                                j();
                                P("success", "🎉 CHÚC MỪNG: BẠN ĐÃ HOÀN THÀNH TOÀN BỘ BÀI HỌC!");
                                L("🎉 HOÀN THÀNH TOÀN BỘ BÀI HỌC!", "#10b981");
                                d = !1;
                                var r = document.getElementById("hud-auto-btn");
                                r && (r.textContent = "✅ Hoàn thành", r.style.background = "rgba(16,185,129,0.2)", r.style.borderColor = "#10b981", r.style.color = "#34d399");
                                var cdBadge1 = document.getElementById("enx-cd-badge");
                                cdBadge1 && (cdBadge1.textContent = "✅", cdBadge1.style.background = "#10b981", cdBadge1.style.color = "#fff");
                                return;
                            }

                            // 3. Question Extraction and Solving
                            var _ = F(n.questionBlockText || i || "");
                            var T = m && m.getVideoTracks().some(function(e) {
                                return "live" === e.readyState;
                            }) ? function() {
                                if (!g || !g.videoWidth) return null;
                                try {
                                    var e = document.createElement("canvas"), t = Math.min(1, 1600 / Math.max(g.videoWidth, g.videoHeight));
                                    e.width = Math.max(1, Math.round(g.videoWidth * t)), e.height = Math.max(1, Math.round(g.videoHeight * t));
                                    var n = e.getContext("2d", { alpha: !1 });
                                    if (!n) return null;
                                    n.drawImage(g, 0, 0, e.width, e.height);
                                    var i = e.toDataURL("image/jpeg", .8);
                                    return !i || i.length < 500 ? null : { image: i, width: e.width, height: e.height };
                                } catch (e) { return null; }
                            }() : null;

                            if (_ || T) {
                                var C = function(e) {
                                    if (!e) return !1;
                                    var t = e.toLowerCase();
                                    return t.includes("chưa đúng") || t.includes("chưa chính xác") || t.includes("chưa thực hiện") || t.includes("thử lại") || t.includes("kiểm tra lại") || t.includes("câu trả lời vừa rồi") || t.includes("lặp lại nhiều lần") || t.includes("thử đến lần") || t.includes("điểm cần lưu ý là") || t.includes("thực chất đang hỏi") || t.includes("suy nghĩ lại") || t.includes("không chính xác") || t.includes("chưa phải") || t.includes("not correct") || t.includes("incorrect") || t.includes("try again") || t.includes("check again") || t.includes("wrong answer") || t.includes("definition of a vocabulary word again");
                                }(n.fullTeacherMsg || i), E = n.fingerprint;

                                if (E !== u || e || C) {
                                    s = !0;
                                    try {
                                        C ? (L("🔄 Giáo viên phản hồi chưa đúng -> Tự động sửa sai theo gợi ý...", "#f59e0b"), 
                                        P("warn", "⚡ Giáo viên phản hồi đáp án chưa đúng! Gửi kèm gợi ý để Gemini giải lại...")) : (L("⚡ Đang tự động phân tích và giải đề...", "#38bdf8"), 
                                        P("info", "⚡ Bắt được câu hỏi! Gửi Gemini Flash-Lite giải ngay..."));

                                        var isEnglishContext = 
                                            /^[a-zA-Z0-9\s.,?!'"\-:;()]+$/.test((_ || i).slice(0, 100)) ||
                                            /\b(what|where|when|why|who|how|which|choose|fill|sentence|paragraph|grammar|vocabulary|modal|verb|english|passage|blank|correct|answer|read|complete|obligation|permission|definition)\b/i.test(_ || i);

                                        var N = [ "Bạn là Trợ lý Học tập FPT EduNext AI Pro v10.2.64 PRO." ];
                                        if (isEnglishContext) {
                                            N.push(
                                                "QUY TẮC BẮT BUỘC CHO MÔN TIẾNG ANH (ENGLISH LESSON):\n" +
                                                "1. Trả lời HOÀN TOÀN BẰNG TIẾNG ANH. Tuyệt đối KHÔNG trả lời bằng tiếng Việt.\n" +
                                                "2. KHÔNG thêm tiền tố 'Trả lời:'. Nếu đề yêu cầu 'Answer: [your answer]', xuất: 'Answer: [đáp án]'.\n" +
                                                "3. Nếu là trắc nghiệm, xuất đáp án chính xác.\n" +
                                                "4. Ngắn gọn, chính xác, không chào hỏi, không giải thích lan man."
                                            );
                                        } else {
                                            N.push(
                                                "QUY TẮC BẮT BUỘC CHO MÔN TIẾNG VIỆT:\n" +
                                                "1. Nếu đề bài yêu cầu trả lời theo mẫu hoặc bắt đầu bằng 'Trả lời:', hãy xuất ĐÚNG ĐÁP ÁN: Trả lời: [đáp án].\n" +
                                                "2. Nếu là trắc nghiệm hoặc bài tập tự luận/toán/lập trình, trả lời ngắn gọn, chính xác, trực tiếp vào trọng tâm.\n" +
                                                "3. Tuyệt đối KHÔNG trả lời lan man dài dòng, KHÔNG nói lời chào."
                                            );
                                        }

                                        N.push(_ ? "CÂU HỎI TRÊN EDUNEXT:\n" + _ : "Dùng ảnh màn hình mới nhất để nhận diện câu hỏi và bài tập trên EduNext.");

                                        // IF 3: Feed full teacher commentary, hint, and past student mistakes to Gemini
                                        if (C || n.hintText || n.fullTeacherMsg || n.lastStudentMsg) {
                                            var teacherFull = n.fullTeacherMsg || i || "";
                                            var hintFull = n.hintText || "";
                                            var prevAnswer = l || n.lastStudentMsg || "";
                                            var pastSubmissions = submittedHistory.slice(-4).map(function(s) { return '"' + s + '"'; }).join(', ');
                                            N.push(
                                                "🚨 PHẢN HỒI, NHẬN XÉT VÀ GỢI Ý (HINT) TỪ GIÁO VIÊN:\n" +
                                                (hintFull ? "Gợi ý cụ thể (Hint): " + hintFull + "\n" : "") +
                                                (teacherFull ? "Lời nhận xét chi tiết của giáo viên:\n\"" + teacherFull + "\"\n" : "") +
                                                (prevAnswer ? "Câu trả lời trước đó của học sinh (đã bị sai hoặc từ chối): \"" + prevAnswer + "\"\n" : "") +
                                                (pastSubmissions ? "Các đáp án đã nộp gần đây (TUYỆT ĐỐI KHÔNG LẶP LẠI): " + pastSubmissions + "\n" : "") +
                                                "-> YÊU CẦU QUAN TRỌNG NHẤT:\n" +
                                                "1. Đọc thật kỹ nhận xét và gợi ý của giáo viên để hiểu bản chất yêu cầu (ví dụ: so sánh 'development' và 'qualified', hay hỏi về tuổi, hay hỏi định nghĩa).\n" +
                                                "2. TUYỆT ĐỐI KHÔNG lặp lại đáp án cũ \"" + prevAnswer + "\" hay các đáp án đã nộp ở trên!\n" +
                                                "3. Xuất đáp án MỚI HOÀN TOÀN, CHÍNH XÁC đáp ứng đúng yêu cầu của giáo viên."
                                            );
                                        }

                                        h = Date.now() + 8000;
                                        var S = N.join("\n\n");
                                        var A = await (async function(prompt, image) {
                                            var keyInfo = o(a);
                                            var r = keyInfo.valid && !keyInfo.expired ? keyInfo.key : null;
                                            if (!r) return P("warn", "Chưa có Key bản quyền! Vui lòng kéo Bookmarklet từ fpt-studyhub."), null;
                                            var rawAns = await solveOnServer(prompt, image);
                                            if (!rawAns) return null;

                                            var finalAnswer = rawAns.trim();
                                            if (isEnglishContext) {
                                                finalAnswer = finalAnswer.replace(/^(?:trả\s*lời|đáp\s*án)\s*:\s*/i, '').trim();
                                                if (/(?:answer|format)\s*:\s*(?:\[|your)/i.test(_ || prompt) && !/^answer\s*:/i.test(finalAnswer)) {
                                                    finalAnswer = 'Answer: ' + finalAnswer;
                                                }
                                            } else {
                                                var requiresMau = /trả\s*lời\s*:\s*\[|theo\s*mẫu/i.test(_ || prompt);
                                                if (requiresMau && !/^\s*trả\s*lời\s*:/i.test(finalAnswer)) {
                                                    finalAnswer = 'Trả lời: ' + finalAnswer;
                                                }
                                            }
                                            return finalAnswer;
                                        })(S, T ? T.image : null);

                                        if (hasActualExercise && /^(?:yes|sẵn\\s*sàng|ready)[!.]?$/i.test(A.trim())) {
                                            P("warn", "⚠️ AI trả lời nhầm 'Yes' cho bài tập, yêu cầu giải lại bài tập chuyên môn...");
                                            return void (s = !1);
                                        }

                                        if (!A || /_{0,2}\s*NO_QUESTION\s*_{0,2}/i.test(A)) {
                                            L("👀 Đang quét câu hỏi trên màn hình...", "#94a3b8");
                                            remaining = 5;
                                            updateCountdownUI();
                                            return void (s = !1);
                                        }

                                        // IF 4: Anti-Duplicate Submission Check
                                        if (isDuplicateSubmission(A)) {
                                            P("warn", '⚠️ Đáp án "' + A.slice(0, 30) + '..." đã từng được nộp trước đó. Yêu cầu Gemini đưa ra đáp án khác...');
                                            var retryPrompt = S + "\n\n🚨 CẢNH BÁO QUAN TRỌNG: Đáp án \"" + A + "\" ĐÃ TỪNG ĐƯỢC NỘP TRƯỚC ĐÓ VÀ BỊ TỪ CHỐI HOẶC BỊ TRÙNG! Hãy đọc kỹ gợi ý và xuất một đáp án MỚI KHÁC HOÀN TOÀN và CHÍNH XÁC!";
                                            var retryAns = await solveOnServer(retryPrompt, T ? T.image : null);
                                            if (retryAns && retryAns.trim() && !isDuplicateSubmission(retryAns)) {
                                                A = retryAns.trim();
                                                if (isEnglishContext) {
                                                    A = A.replace(/^(?:trả\s*lời|đáp\s*án)\s*:\s*/i, '').trim();
                                                    if (/(?:answer|format)\s*:\s*(?:\[|your)/i.test(_ || retryPrompt) && !/^answer\s*:/i.test(A)) {
                                                        A = 'Answer: ' + A;
                                                    }
                                                }
                                                P("success", '✓ Gemini đổi sang đáp án mới: "' + A.slice(0, 35) + '..."');
                                            }
                                        }

                                        if (l && A.trim().toLowerCase() === l.trim().toLowerCase() && !C) {
                                            L("👀 Đã nộp đáp án '" + l.slice(0, 20) + "', chờ EduNext sang câu mới...", "#38bdf8");
                                            remaining = 5;
                                            updateCountdownUI();
                                            return void (s = !1);
                                        }

                                        P("success", '✓ Gemini Flash-Lite trả lời: "' + A.slice(0, 35) + '..."');
                                        L("✍️ Đang làm sạch ô nhập & nộp bài...", "#34d399");

                                        // IF 5: Safe submit - check active input without throwing false abort
                                        await (async function() {
                                            var curInput = (function() {
                                                for (var els = document.querySelectorAll('textarea.w-md-editor-text-input, .w-md-editor textarea, textarea, input[type="text"]'), idx = 0; idx < els.length; idx++) {
                                                    var el = els[idx];
                                                    if (!el.closest('#enx-pro-hud') && el.offsetParent !== null && !el.disabled && !el.readOnly) return el;
                                                }
                                                return null;
                                            })();
                                            if (!curInput) throw new Error('Không tìm thấy ô nhập liệu để nộp bài.');
                                            if (!await z(A)) throw new Error('Chưa điền/nộp được câu trả lời.');
                                            submittedHistory.push(A);
                                            if (submittedHistory.length > 25) submittedHistory.shift();
                                            u = E;
                                            l = A;
                                        })(), P("success", "✓ ĐÃ NỘP XONG! Tự động chờ câu hỏi tiếp theo..."), remaining = 35, updateCountdownUI(), 
                                        L("👀 Đang theo dõi khi nào câu hỏi tiếp theo hiện lên...", "#38bdf8");
                                    } catch (e) {
                                        P("err", "Lỗi: " + (e.message || e));
                                    } finally {
                                        s = !1;
                                    }
                                } else L("👀 Đang theo dõi khi nào có câu hỏi mới...", "#94a3b8");
                            } else {
                                if (isManual) {
                                    alert("Chưa thấy câu hỏi mới trên trang. Nếu đề bài dạng hình ảnh, hãy bấm [Chia Sẻ Màn Hình]!");
                                    R();
                                } else {
                                    L("👀 Đang quét câu hỏi trên màn hình...", "#94a3b8");
                                    remaining = 5;
                                    updateCountdownUI();
                                }
                            }
                        }
                    } else {
                        if (activeInput) {
                            F(false, false);
                        } else {
                            L("👀 Đã nộp bài, đang chờ EduNext phản hồi...", "#38bdf8");
                        }
                    }
                } else {
                    d = !1, L("⛔ " + t.reason, "#ef4444"), P("warn", "⛔ " + t.reason);
                    var M = document.getElementById("hud-auto-btn");
                    M && (M.textContent = "⏸ Auto: TẮT", M.style.background = "rgba(239,68,68,0.2)", 
                    M.style.borderColor = "#ef4444", M.style.color = "#fca5a5");
                }
            }
        }
        b.appendChild(q), O();
        var timerInterval = setInterval(function() {
            if (!d) {
                updateCountdownUI();
                return;
            }
            remaining--;
            updateCountdownUI();
            if (remaining <= 0) {
                remaining = 35;
                updateCountdownUI();
                Q(!0, !1);
            }
        }, 1000);
        b.addEventListener("enx_destroy", function() {
            clearInterval(timerInterval);
            window.__ENX_PRO_HUD__ = !1;
            window.__ENX_VERSION__ = null;
        });
        (document.body || document.documentElement).appendChild(b);
    } catch (Z) {
        alert("Lỗi khởi động EduNext AI Pro: " + Z.message);
    }
}