function e(e, serverOrigin) {
    try {
        var t = "v10.2.51";
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
        // Display expiry only; server verifies signature, ownership and revocation.
        function o(token) {
            try {
                if (typeof token !== 'string' || !token.startsWith('FPT1.')) throw new Error('Cần license mới do admin cấp.');
                var encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                var claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))));
                if (!Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= Date.now()) throw new Error('License đã hết hạn.');
                return { valid: true, expired: false, key: token, plan: claims.plan, expDate: new Date(claims.expiresAt).toLocaleString('vi-VN'), remDays: Math.ceil((claims.expiresAt-Date.now())/86400000) };
            } catch (error) { return { valid: false, reason: error.message }; }
        }
        try { localStorage.removeItem('enx_encrypted_ai_key'); localStorage.removeItem('enx_license_key'); } catch (_) {}
        var a = e || '', s = false, c = 0, l = '', u = '', d = true, h = 0, m = null, g = null, f = null, remaining = 35;
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
                if (window.fetch && !window.__enx_fetch_hooked) {
                    var e = window.fetch;
                    window.fetch = async function(...t) {
                        try {
                            var n = await e.apply(this, t);
                            return n && 429 === n.status && (h = Date.now() + 25e3, P("warn", "EduNext 429 Too Many Requests -> Tự động hoãn 25s bảo vệ nick")), 
                            n;
                        } catch (n) {
                            throw n;
                        }
                    }, window.__enx_fetch_hooked = !0;
                }
                if (window.XMLHttpRequest && !window.__enx_xhr_hooked) {
                    var t = XMLHttpRequest.prototype.send;
                    XMLHttpRequest.prototype.send = function(...e) {
                        return this.addEventListener("load", (function() {
                            429 === this.status && (h = Date.now() + 25e3, P("warn", "EduNext 429 Too Many Requests (XHR) -> Tự động hoãn 25s"));
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
                if (t.allowed) return e ? void Q(!0) : (alert("Vui lòng bấm [📸 Chia Sẻ Màn Hình] để bot có thể chụp ảnh đề bài!"), 
                void R());
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
                    Q(!0);
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
            i ? P("info", "Key hợp lệ (Gọi trực tiếp Google Gemini Flash-Lite)") : P("warn", "Chưa có Key bản quyền hợp lệ (Bắt đầu bằng ENC_AI_)");
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
                Q(!0);
            } catch (e) {
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
                if (s.length >= 3) {
                    var c = Math.min.apply(null, s), l = i - (r - c), u = Math.ceil(l / 864e5), d = Math.ceil(l / 36e5);
                    return {
                        allowed: !1,
                        course: e,
                        reason: "Môn [" + e.label + "] đã làm đủ " + s.length + "/3 bài trong tuần này. Giới hạn bản quyền: 3 bài / tuần (vui lòng chờ " + (u > 1 ? u + " ngày" : d + " giờ") + ")."
                    };
                }
            }
            var h = 6, p = o(a);
            if (p.valid && p.plan && (p.plan.includes("1 Tuần") ? h = 3 : p.plan.includes("1 Tháng") ? h = 5 : p.plan.includes("Kỳ") && (h = 6)), 
            !t.courses[e.key]) {
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
            }(t), P("warn", "📌 Đã ghi nhận hoàn thành bài (" + r.length + "/3 bài tuần này) cho môn: " + e.label);
        }
        function F(e) {
            if (!e) return "";
            var t = e.replace(/\r\n/g, "\n"), n = t.search(/(?:câu\s*hỏi|question|bài\s*sau)\s*:/i);
            return -1 !== n && (t = t.slice(n)), (t = (t = (t = t.replace(/[0-9a-f]{20,}/gi, "")).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")).replace(/(?:Feedback|Sửa công thức(?:\s*\(\d+\))?|Đã chấm bằng AI|INT:\s*\w+)/gi, "")).trim();
        }
        async function solveOnServer(question, image) {
            var payload = { licenseKey: a, question: question, images: image ? [image] : [] };
            var gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : window.__ENX_GM_XHR__;
            if (typeof gm === 'function') {
                return new Promise(function(resolve) {
                    gm({ method: 'POST', url: apiOrigin + '/api/v1/ai/solve', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify(payload), timeout: 25000,
                      onload: function(response) { try { var result = JSON.parse(response.responseText); if (response.status === 429) h = Date.now() + 30000; if (!result.success) P('warn', result.message || 'AI chưa sẵn sàng'); resolve(result.success ? result.answer : null); } catch (_) { resolve(null); } },
                      onerror: function() { resolve(null); }, ontimeout: function() { resolve(null); }
                    });
                });
            }
            if (!f || f.closed) { P('warn', 'Bấm Mở Cầu Nối AI trước khi chạy.'); return null; }
            return new Promise(function(resolve) {
                var requestId = crypto.randomUUID();
                var timer = setTimeout(function() { window.removeEventListener('message', receive); resolve(null); }, 25000);
                function receive(event) {
                    if (event.origin !== apiOrigin || event.source !== f || event.data?.type !== 'ENX_SOLVE_RES' || event.data.requestId !== requestId) return;
                    clearTimeout(timer); window.removeEventListener('message', receive);
                    if (event.data.status === 429) h = Date.now() + 30000;
                    if (!event.data.success) P('warn', event.data.error || 'AI chưa sẵn sàng');
                    resolve(event.data.success ? event.data.answer : null);
                }
                window.addEventListener('message', receive);
                f.postMessage({ type: 'ENX_SOLVE_REQ', requestId: requestId, payload: payload }, apiOrigin);
            });
        }
        async function Q(e) {
            if ((d || e) && !s) {
                var t = K();
                if (t.allowed) {
                    var n = readEduNextTurn(document);
                    if (n.state === 'idle' && !e) return;
                    if ("waiting_teacher" !== n.state || e) if (Date.now() < h) L("⏳ Chờ hồi phục Rate Limit 429 (" + Math.ceil((h - Date.now()) / 1e3) + "s)...", "#f59e0b"); else if (Date.now() - c < 4e3 && !e) L("⏳ Chờ EduNext cập nhật sau khi nộp...", "#94a3b8"); else {
                        var i = n.lastTeacherMsg || "";
                        if (b = (i || ""), 
                        /chúc\s*mừng\s*(?:em|bạn)?\s*hoàn\s*thành\s*buổi\s*học/i.test(b) || /điểm\s*buổi\s*học\s*:\s*\d+\s*\/\s*\d+/i.test(b) || /hẹn\s*gặp\s*(?:em|bạn).{0,30}buổi\s*học\s*tiếp\s*theo/i.test(b) || /chúc\s*mừng.{0,60}(?:hoàn\s*thành|kết\s*thúc).{0,40}(?:buổi\s*học|bài\s*học|khóa\s*học)/i.test(b) || /(?:buổi\s*học|bài\s*học|khóa\s*học).{0,40}(?:đã\s*hoàn\s*thành|đã\s*kết\s*thúc)/i.test(b) || /congratulations.{0,80}(?:completed|finished).{0,60}(?:lesson|session|course)/i.test(b)) {
                            j(), P("success", "🎉 CHÚC MỪNG: BẠN ĐÃ HOÀN THÀNH TOÀN BỘ BÀI HỌC!"), L("🎉 HOÀN THÀNH TOÀN BỘ BÀI HỌC!", "#10b981"), 
                            d = !1;
                            var r = document.getElementById("hud-auto-btn");
                            r && (r.textContent = "✅ Hoàn thành", r.style.background = "rgba(16,185,129,0.2)", r.style.borderColor = "#10b981", r.style.color = "#34d399");
                            var cdBadge1 = document.getElementById("enx-cd-badge");
                            cdBadge1 && (cdBadge1.textContent = "✅", cdBadge1.style.background = "#10b981", cdBadge1.style.color = "#fff");
                        } else {
                            var b, y = function(e) {
                                if (!e) return !1;
                                var t = e.includes("Câu hỏi") || e.includes("Hãy trả lời") || /\bQuestion\b/i.test(e) || /Please try the exercise/i.test(e) || /\?/i.test(e), n = e.includes("Trả lời:") || e.includes("trả lời theo") || e.includes("điền đáp án") || /\bAnswer\s*:/i.test(e) || /Use this answer format/i.test(e);
                                return t && n;
                            }(i) || /câu hỏi|bài sau|hãy làm|trả lời:|đáp án|\?/i.test(i), v = function(e) {
                                try {
                                    for (var t = Array.from(document.querySelectorAll('button, [role="button"], .quick-reply, .chat-chip, .suggestion-item, [class*="chip"], [class*="quick"], [class*="suggestion"], .quick-insert-btn')), n = 0; n < t.length; n++) {
                                        var i = t[n];
                                        if (!i.closest("#enx-pro-hud") && !(i.disabled || null === i.offsetParent || e && i.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                                            var r = (i.innerText || i.textContent || "").replace(/\s+/g, " ").trim();
                                            if (/^(?:sẵn\s*sàng|ready|tôi\s*đã\s*sẵn\s*sàng|i'm\s*ready|im\s*ready)[!.]?$/i.test(r)) return i;
                                        }
                                    }
                                } catch (e) {}
                                return null;
                            }(n.lastStudentBadge);
                            if (!y && (/bạn\s*đã\s*sẵn\s*sàng|sẵn\s*sàng\s*chuyển\s*sang|are\s*you\s*ready|ready\s*to\s*move\s*on|sẵn\s*sàng\s*chưa/i.test(i) || v)) {
                                var w = /ready/i.test(i) ? "Ready" : "Sẵn sàng";
                                if (P("info", "🎯 Bắt được lời nhắc/nút [" + w + "] -> Tự động bấm & gửi để chuyển phần!"), 
                                L('🎯 Bấm "' + w + '" chuyển phần...', "#10b981"), v) try {
                                    U(v);
                                } catch (e) {}
                                return await z(w), void L("👀 Đang chờ câu hỏi tiếp theo hiện lên...", "#38bdf8");
                            }
                            var _ = F(n.questionBlockText || i || ""), T = m && m.getVideoTracks().some((function(e) {
                                return "live" === e.readyState;
                            })) ? function() {
                                if (!g || !g.videoWidth) return null;
                                try {
                                    var e = document.createElement("canvas"), t = Math.min(1, 1600 / Math.max(g.videoWidth, g.videoHeight));
                                    e.width = Math.max(1, Math.round(g.videoWidth * t)), e.height = Math.max(1, Math.round(g.videoHeight * t));
                                    var n = e.getContext("2d", {
                                        alpha: !1
                                    });
                                    if (!n) return null;
                                    n.drawImage(g, 0, 0, e.width, e.height);
                                    var i = e.toDataURL("image/jpeg", .8);
                                    return !i || i.length < 500 ? null : {
                                        image: i,
                                        width: e.width,
                                        height: e.height
                                    };
                                } catch (e) {
                                    return null;
                                }
                            }() : null;
                            if (_ || T) {
                                var C = function(e) {
                                    if (!e) return !1;
                                    var t = e.toLowerCase();
                                    return t.includes("chưa đúng") || t.includes("chưa chính xác") || t.includes("chưa thực hiện") || t.includes("thử lại") || t.includes("kiểm tra lại") || t.includes("câu trả lời vừa rồi") || t.includes("lặp lại nhiều lần") || t.includes("thử đến lần") || t.includes("điểm cần lưu ý là") || t.includes("thực chất đang hỏi") || t.includes("suy nghĩ lại") || t.includes("không chính xác") || t.includes("chưa phải") || t.includes("not correct") || t.includes("incorrect") || t.includes("try again") || t.includes("check again") || t.includes("wrong answer");
                                }(i), E = n.fingerprint;
                                if (E !== u || e) {
                                    s = !0;
                                    try {
                                        C ? (L("🔄 Giáo viên phản hồi chưa đúng -> Tự động sửa sai theo gợi ý...", "#f59e0b"), 
                                        P("warn", "⚡ Giáo viên phản hồi đáp án chưa đúng! Gửi kèm gợi ý để Gemini giải lại...")) : (L("⚡ Đang tự động phân tích và giải đề...", "#38bdf8"), 
                                        P("info", "⚡ Bắt được câu hỏi! Gửi Gemini Flash-Lite giải ngay..."));
                                        var N = [ "Bạn là Trợ lý Học tập FPT EduNext AI Pro.", _ ? "CÂU HỎI TRÊN EDUNEXT:\n" + _ : "Dùng ảnh màn hình mới nhất để nhận diện câu hỏi và bài tập trên EduNext." ];
                                        if (C || i && n.lastStudentMsg) {
                                            var k = l || n.lastStudentMsg;
                                            N.push('🚨 LƯU Ý ĐẶC BIỆT - GIÁO VIÊN VỪA TỪ CHỐI ĐÁP ÁN VÀ ĐƯA RA GỢI Ý:\n- Đáp án sai học sinh vừa gửi: "' + k + '" (CÂU NÀY ĐÃ SAI HOẶC BỊ TỪ CHỐI)\n- Toàn bộ phản hồi, phân tích và gợi ý của Giáo viên:\n"' + i + '"\n-> YÊU CẦU BẮT BUỘC:\n1. Đọc thật kỹ phân tích và gợi ý của giáo viên ở trên.\n2. Tìm ra bản chất câu hỏi thực sự đang yêu cầu (tên gọi đại lượng, lực, công thức, số lượng, v.v.).\n3. Xuất đáp án MỚI HOÀN TOÀN, CHÍNH XÁC. TUYỆT ĐỐI KHÔNG lặp lại đáp án cũ "' + k + '"!');
                                        }
                                        N.push('QUY TẮC BẮT BUỘC:\n1. Nếu đề bài yêu cầu trả lời theo mẫu hoặc bắt đầu bằng "Trả lời:", hãy xuất ĐÚNG ĐÁP ÁN: Trả lời: [đáp án].\n2. Nếu là trắc nghiệm hoặc bài tập tự luận/toán/lập trình, trả lời ngắn gọn, chính xác, trực tiếp vào trọng tâm.\n3. Tuyệt đối KHÔNG trả lời lan man dài dòng, KHÔNG nói lời chào.\n4. Nếu bài học đã kết thúc, xuất mã: __LESSON_COMPLETE__');
                                        h = Date.now() + 8000;
                                        var S = N.join("\n\n"), A = await async function(e, t) {
                                            var n, i = /trả lời:\s*\[|theo mẫu/i.test(e), r = (n = o(a)).valid && !n.expired ? n.key : null;
                                            if (!r) return P("warn", "Chưa có Key bản quyền! Vui lòng kéo Bookmarklet từ fpt-studyhub."), 
                                            null;
                                            var s = await solveOnServer(e, t);
                                            return s ? (!i || /^\s*(?:tr[aả]\s*l[oờ]i|answer)\s*:/i.test(s) || s.startsWith("__") || (s = "Trả lời: " + s), 
                                            s) : null;
                                        }(S, T ? T.image : null);
                                        if (!A || /_{0,2}\s*NO_QUESTION\s*_{0,2}/i.test(A)) return L("👀 Đang theo dõi khi nào câu hỏi hiện lên...", "#94a3b8"), 
                                        void (s = !1);
                                        if (/_{0,2}\s*LESSON_COMPLETE\s*_{0,2}/i.test(A)) {
                                            j(), P("success", "🎉 CHÚC MỪNG: BẠN ĐÃ HOÀN THÀNH TOÀN BỘ BÀI HỌC!"), L("🎉 HOÀN THÀNH TOÀN BỘ BÀI HỌC!", "#10b981"), 
                                            d = !1;
                                            var I = document.getElementById("hud-auto-btn");
                                            I && (I.textContent = "✅ Hoàn thành", I.style.background = "rgba(16,185,129,0.2)", I.style.borderColor = "#10b981", I.style.color = "#34d399");
                                            var cdBadge2 = document.getElementById("enx-cd-badge");
                                            cdBadge2 && (cdBadge2.textContent = "✅", cdBadge2.style.background = "#10b981", cdBadge2.style.color = "#fff");
                                            return void (s = !1);
                                        }
                                        if (l && A.trim().toLowerCase() === l.trim().toLowerCase() && C) return P("warn", '⚠️ Gemini vẫn trả lời đáp án cũ "' + A + '", đang thử yêu cầu đáp án khác...'), 
                                        void (s = !1);
                                        P("success", '✓ Gemini Flash-Lite trả lời: "' + A.slice(0, 35) + '..."'), L("✍️ Đang làm sạch ô nhập & nộp bài...", "#34d399"), 
                                        await (async function() {
                                            if (readEduNextTurn(document).fingerprint !== E) throw new Error('Câu hỏi đã đổi khi AI đang giải. Bỏ đáp án cũ.');
                                            if (!await z(A)) throw new Error('Chưa điền/nộp được câu trả lời.');
                                            u = E;
                                        })(), P("success", "✓ ĐÃ NỘP XONG! Tự động chờ câu hỏi tiếp theo..."), remaining = 35, updateCountdownUI(), 
                                        L("👀 Đang theo dõi khi nào câu hỏi tiếp theo hiện lên...", "#38bdf8");
                                    } catch (e) {
                                        P("err", "Lỗi: " + (e.message || e));
                                    } finally {
                                        s = !1;
                                    }
                                } else L("👀 Đang theo dõi khi nào có câu hỏi mới...", "#94a3b8");
                            } else e ? (alert("Chưa thấy câu hỏi mới trên trang. Nếu đề bài dạng hình ảnh, hãy bấm [Chia Sẻ Màn Hình]!"), 
                            R()) : L("👀 Đang theo dõi khi nào câu hỏi hiện lên...", "#94a3b8");
                        }
                    } else L("👀 Đã nộp bài, đang chờ EduNext phản hồi...", "#38bdf8");
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
                Q(!1);
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