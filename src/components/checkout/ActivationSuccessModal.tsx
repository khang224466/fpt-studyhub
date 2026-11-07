'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, Copy, Check, ExternalLink, Zap, ArrowRight, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';
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
  const [copiedScript, setCopiedScript] = useState(false);
  const [host, setHost] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.origin);
    }
  }, []);

  if (!order || !service || !licenseKey) return null;

  const bookmarkletJs = generateBookmarkletCode(licenseKey, host || 'https://passshare.vercel.app');

  const copyLicense = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletJs);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thanh Toán Thành Công!"
      description="Gói dịch vụ đã sẵn sàng kích hoạt ngay tức khắc."
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
                Đã mở khóa gói: {service.name}
              </div>
              <div className="text-xs text-emerald-300">
                Thời hạn: {order.durationLabel} • Trạng thái: Đã cấp quyền
              </div>
            </div>
          </div>
          <Badge variant="emerald" size="sm">Đã Thanh Toán</Badge>
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

        {/* DRAGGABLE BOOKMARKLET HERO BOX */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-emerald-950/30 border-2 border-dashed border-emerald-500/50 text-center space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-semibold mb-2">
              <Zap className="w-3.5 h-3.5 fill-current" />
              Cách Dùng Dễ Nhất: Kéo Thả 1 Giây
            </span>
            <h4 className="text-lg font-bold text-white">
              Kéo Nút Xanh Dưới Đây Thả Lên Thanh Dấu Trang (Bookmarks Bar):
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              (Nếu chưa thấy thanh dấu trang, hãy nhấn tổ hợp phím <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[11px]">Ctrl + Shift + B</kbd> trên Chrome/Edge)
            </p>
          </div>

          {/* The Actual Draggable Anchor Tag */}
          <div className="py-2">
            <a
              href={bookmarkletJs}
              draggable="true"
              onClick={(e) => {
                e.preventDefault();
                alert('👉 Bạn hãy dùng chuột KÉO (drag) nút này rồi thả lên thanh dấu trang (Bookmarks Bar) trên trình duyệt!');
              }}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-950/70 hover:scale-105 active:scale-95 transition-all cursor-grab active:cursor-grabbing border border-emerald-400/40 select-none animate-pulse"
              title="Kéo tôi lên thanh Bookmarks Bar!"
            >
              <Bookmark className="w-5 h-5 fill-current" />
              <span>⚡ Kích Hoạt {service.name}</span>
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={copyBookmarklet}
              className="text-xs gap-1.5"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScript ? 'Đã sao chép mã script' : 'Sao chép mã Bookmarklet'}</span>
            </Button>
            <a
              href={`${host}/edunext.user.js?key=${encodeURIComponent(licenseKey)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cài Tampermonkey (v10.1.1)</span>
            </a>
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
            <p className="text-slate-400 leading-relaxed">
              Bạn không cần phải tìm hiểu hay tự mua API Key từ Google AI Studio hay Groq. Toàn bộ yêu cầu giải bài tập của gói Trial được mã hóa và xử lý tự động qua cổng <strong>FPT StudyHub Cloud AI Proxy</strong>.
            </p>
          </div>
        </div>

        {/* 3 Step Quick Instructions */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs text-slate-300">
          <div className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Hướng Dẫn 2 Bước Đăng Nhập Sau Khi Kéo:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
            <li>
              Mở trang web chính thức của dịch vụ:{' '}
              <a
                href={`https://${service.targetDomain}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 font-semibold underline underline-offset-2 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                <span>https://{service.targetDomain}</span>
                <ExternalLink className="w-3 h-3 inline" />
              </a>
            </li>
            <li>
              Trên trang đó, click 1 phát vào nút <strong>⚡ Kích Hoạt {service.name}</strong> bạn vừa kéo lên thanh dấu trang.
            </li>
            <li>
              Bảng điều khiển HUD của trợ lý <strong>EduNext AI Pro v10.1.1</strong> sẽ xuất hiện ngay góc màn hình để tự động giải và nộp bài theo đúng mẫu quy định!
            </li>
          </ol>
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
