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
      const res = await fetch('/FPT_EduNext_Assistant_v10.1.1.user.js');
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        setCopiedFullScript(true);
        setTimeout(() => setCopiedFullScript(false), 3000);
        return;
      }
    } catch (_) {}
    // Fallback if fetch fails
    navigator.clipboard.writeText(`// Tải từ http://localhost:8443/FPT_EduNext_Assistant_v10.1.1.user.js`);
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
                Đã mở khóa: {service.name} (v10.1.1)
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

        {/* PRIMARY HERO: TAMPERMONKEY 1-CLICK (RECOMMENDED) */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/40 border-2 border-emerald-500/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cách 1 (Khuyên Dùng): Cài Qua Tampermonkey</span>
                <Badge variant="emerald" size="sm">Chuẩn 100%</Badge>
              </h4>
            </div>
            <span className="text-xs text-slate-400">Không bị chặn CSP</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Tampermonkey chạy ở tầng Extension của trình duyệt, vượt qua hoàn toàn rào cản bảo mật của EduNext và tự động hiển thị bảng điều khiển HUD mỗi khi bạn mở bài học.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Button
              size="md"
              variant="primary"
              onClick={copyFullUserscript}
              className="gap-2 text-xs font-bold shadow-lg shadow-emerald-950/80"
            >
              {copiedFullScript ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copiedFullScript ? '✓ Đã chép toàn bộ mã script!' : '📋 Sao Chép Mã Userscript v10.1.1'}</span>
            </Button>

            <a
              href={`${host}/FPT_EduNext_Assistant_v10.1.1.user.js`}
              download="FPT_EduNext_Assistant_v10.1.1.user.js"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>📥 Tải Tệp .user.js Về Máy</span>
            </a>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="font-bold text-white text-[11px] uppercase tracking-wider">
              3 Bước Dán Vào Tampermonkey:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
              <li>Bấm nút <strong>"Sao Chép Mã Userscript"</strong> ở trên.</li>
              <li>Mở Tampermonkey trên Edge/Chrome 👉 Chọn <strong>"Thêm script mới"</strong> (hoặc dấu <code>+</code>).</li>
              <li>Dán mã vào (<code>Ctrl + V</code>) rồi nhấn <code>Ctrl + S</code> để Lưu. F5 lại trang EduNext là xong!</li>
            </ol>
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
