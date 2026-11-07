'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Copy, 
  Check, 
  ExternalLink, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle,
  Code2,
  Terminal
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { OrderItem, ServiceItem } from '@/types/rental';
import { generateBookmarkletCode } from '@/lib/utils';

interface ActivationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderItem | null;
  service: ServiceItem | null;
  licenseKey: string;
}

export function ActivationSuccessModal({
  isOpen,
  onClose,
  order,
  service,
  licenseKey
}: ActivationSuccessModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedFullScript, setCopiedFullScript] = useState(false);
  const [copiedConsoleCode, setCopiedConsoleCode] = useState(false);
  const [host, setHost] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.origin);
    }
  }, []);

  if (!order || !service || !licenseKey) return null;

  const copyLicense = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyFullUserscript = async () => {
    try {
      const res = await fetch('/FPT_EduNext_Assistant_v10.1.2.user.js');
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        setCopiedFullScript(true);
        setTimeout(() => setCopiedFullScript(false), 3000);
        return;
      }
    } catch (_) {}
    // Fallback if fetch fails
    navigator.clipboard.writeText(`// Tải từ http://localhost:8443/FPT_EduNext_Assistant_v10.1.2.user.js`);
    setCopiedFullScript(true);
    setTimeout(() => setCopiedFullScript(false), 3000);
  };

  const consoleOneLiner = `(function(){const s=document.createElement('script');s.src='${host || 'http://localhost:8443'}/inject.js?key=${licenseKey}&t='+Date.now();document.head.appendChild(s);})();`;

  const copyConsoleCode = () => {
    navigator.clipboard.writeText(consoleOneLiner);
    setCopiedConsoleCode(true);
    setTimeout(() => setCopiedConsoleCode(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kích Hoạt Gói Dịch Vụ Thành Công!"
      description="Gói dịch vụ đã sẵn sàng hoạt động trên hệ thống EduNext."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Success Header Banner */}
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-950/60">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">
                Đã mở khóa: {service.name} (v10.1.2)
              </div>
              <div className="text-xs text-emerald-300">
                Thời hạn: {order.durationLabel} • Trạng thái: Đã cấp quyền
              </div>
            </div>
          </div>
          <Badge variant="emerald" size="sm">Đã Kích Hoạt</Badge>
        </div>

        {/* License Key Box */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="text-xs text-slate-400 font-medium">Mã Bản Quyền (License Key Cá Nhân):</div>
          <div className="flex items-center justify-between gap-3 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
            <span className="font-mono text-emerald-400 font-bold text-sm tracking-wide select-all truncate">
              {licenseKey}
            </span>
            <Button size="sm" variant="outline" onClick={copyLicense} className="shrink-0">
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? 'Đã chép' : 'Sao chép'}</span>
            </Button>
          </div>
        </div>

        {/* NOTICE: WHY BOOKMARKLET IS BLOCKED BY EDUNEXT CSP */}
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-slate-300">
            <div className="font-bold text-amber-300">
              Lưu ý quan trọng khi chạy trên EduNext LMS:
            </div>
            <p className="text-slate-400 leading-relaxed">
              Trang web <code>fsc-edunext.fpt.edu.vn</code> áp dụng chính sách bảo mật <strong>Cloudflare CSP & Trusted Types</strong> cấm chèn script từ thanh Bookmark. Để trợ lý hoạt động <strong>100% tự động và mượt mà</strong>, bạn hãy dùng tiện ích <strong>Tampermonkey</strong> (đã cài sẵn trên Edge/Chrome của bạn).
            </p>
          </div>
        </div>

        {/* PRIMARY HERO: STANDALONE EXTENSION (NO TAMPERMONKEY NEEDED) */}
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/40 border-2 border-emerald-500/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cách 1 (Khuyên Dùng): Tiện Ích Trình Duyệt Độc Lập</span>
                <Badge variant="emerald" size="sm">Zero Tampermonkey</Badge>
              </h4>
            </div>
            <span className="text-xs text-emerald-400 font-semibold">Tự động 100%</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Tiện ích mở rộng chuyên dụng cho Microsoft Edge & Google Chrome (Manifest V3), tự động chạy vĩnh viễn trên EduNext, <strong>hoàn toàn không cần cài Tampermonkey</strong> và không bao giờ bị chặn CSP.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>3 Bước Cài Đặt Trong 10 Giây:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-[11px]">
              <li>Mở trình duyệt, truy cập vào: <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">edge://extensions</code> (hoặc <code className="text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">chrome://extensions</code>).</li>
              <li>Bật công tắc <strong>"Chế độ dành cho nhà phát triển" (Developer mode)</strong> ở góc trái/phải.</li>
              <li>Bấm nút <strong>"Tải phần mở rộng đã giải nén" (Load unpacked)</strong> 👉 Chọn thư mục:
                <div className="mt-1 p-2 bg-slate-900 rounded border border-slate-800 font-mono text-emerald-300 select-all text-[11px] break-all">
                  d:\BUISINESS\edunext_chrome_extension
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* SECONDARY: 100% INLINE BOOKMARKLET */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-emerald-400" />
              <span>Cách 2: Bookmarklet Trực Tiếp (Không Cần Tampermonkey)</span>
            </div>
            <Badge variant="cyan" size="sm">1-Click Bookmark</Badge>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Mã chạy độc lập 100% in-memory (đã sửa toàn bộ lỗi cú pháp và mã hóa URI an toàn). Nhấn nút dưới đây để sao chép mã và dán vào ô <strong>URL của Bookmark</strong> trên trình duyệt:
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const code = generateBookmarkletCode(licenseKey, host || 'http://localhost:8443');
                navigator.clipboard.writeText(code);
                setCopiedFullScript(true);
                setTimeout(() => setCopiedFullScript(false), 2000);
              }}
              className="text-xs gap-1.5 font-bold"
            >
              {copiedFullScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFullScript ? '✓ Đã sao chép Bookmarklet' : '📋 Sao Chép Mã Bookmarklet'}</span>
            </Button>
          </div>
        </div>

        {/* SECONDARY: F12 CONSOLE ONE-LINER */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Cách 2: Mở Console F12 Dán 1 Lệnh (Không Cần Cài Tiện Ích)</span>
            </div>
            <Badge variant="cyan" size="sm">Siêu Tốc</Badge>
          </div>
          <p className="text-[11px] text-slate-400">
            Khi đang ở trên trang EduNext, nhấn phím <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[10px]">F12</kbd> (hoặc <code>Ctrl + Shift + I</code>) 👉 Chọn tab <strong>Console</strong> 👉 Dán lệnh dưới đây và nhấn <strong>Enter</strong>:
          </p>
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="truncate">{consoleOneLiner}</span>
            <Button size="sm" variant="outline" onClick={copyConsoleCode} className="shrink-0 text-xs">
              {copiedConsoleCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedConsoleCode ? 'Đã chép' : 'Chép'}</span>
            </Button>
          </div>
        </div>

        {/* Security / Encrypted Key Guarantee Banner */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span>Bảo Vệ & Mã Hóa API Key Trực Tiếp Từ Máy Chủ</span>
              <Badge variant="emerald" size="sm">An Toàn 100%</Badge>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Bạn không cần phải tìm hiểu hay tự mua API Key. Toàn bộ yêu cầu giải bài tập của gói Trial được mã hóa và xử lý tự động qua cổng <strong>FPT StudyHub Cloud AI Proxy</strong>.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">Mã đơn: {order.orderId}</span>
          <Button variant="primary" onClick={onClose}>
            Hoàn Tất & Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
