'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Copy, 
  Check, 
  Zap, 
  ShieldCheck, 
  Sparkles,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { OrderItem, ServiceItem } from '@/types/rental';
import { generateBookmarkletCode } from '@/lib/utils';
import { BANK_CONFIG } from '@/data/servicesCatalog';

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
  const [copiedBookmarkCode, setCopiedBookmarkCode] = useState(false);
  const [host, setHost] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.origin);
      if (licenseKey) {
        try {
          localStorage.setItem('enx_encrypted_ai_key', licenseKey);
          localStorage.setItem('enx_license_key', licenseKey);
        } catch (_) {}
      }
    }
  }, [licenseKey]);

  if (!order || !service || !licenseKey) return null;

  const bookmarkCode = generateBookmarkletCode(licenseKey, host || 'https://fpt-studyhub.vercel.app');

  const copyBookmark = () => {
    navigator.clipboard.writeText(bookmarkCode);
    setCopiedBookmarkCode(true);
    setTimeout(() => setCopiedBookmarkCode(false), 2000);
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
                Đã mở khóa: {service.name} (v10.2.51)
              </div>
              <div className="text-xs text-emerald-300">
                Thời hạn: {order.durationLabel} • Trạng thái: Đã cấp quyền
              </div>
            </div>
          </div>
          <Badge variant="emerald" size="sm">Đã Kích Hoạt</Badge>
        </div>

        {/* Zero-Leak Integrated License Card */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Bản Quyền Đã Tích Hợp Sẵn Vào Bookmarklet</span>
            </div>
            <Badge variant="emerald" size="sm">Tự Động 100%</Badge>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Mã bản quyền gói <strong className="text-emerald-400">{order.durationLabel}</strong> đã được hệ thống nhúng trực tiếp vào nút Bookmark bên dưới. Bạn <strong className="text-white">không cần sao chép hay nhập key thủ công</strong> — chỉ cần kéo nút màu xanh lên thanh Bookmark và bấm chạy!
          </p>
        </div>

        {/* HERO: THE BIG GLOWING DRAGGABLE BOOKMARKLET BUTTON (CẦM KÉO LÊN LÀ XONG) */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-500/70 shadow-2xl shadow-emerald-950/80 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-4 h-4 animate-bounce text-emerald-400" />
            <span>Chỉ Cần 1 Thao Tác Kéo Thả Duy Nhất (Không Cần Cài Đặt):</span>
          </div>

          <div className="py-2 flex justify-center">
            <a
              href={bookmarkCode}
              draggable="true"
              onDragStart={(e) => {
                try {
                  e.dataTransfer.clearData();
                  e.dataTransfer.setData('text/uri-list', bookmarkCode);
                  e.dataTransfer.setData('URL', bookmarkCode);
                  e.dataTransfer.setData('text/plain', bookmarkCode);
                } catch (_) {}
              }}
              onClick={() => {
                copyBookmark();
              }}
              className="inline-flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-black text-base sm:text-lg shadow-xl shadow-emerald-950/90 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing border-2 border-emerald-300/50 select-none animate-pulse"
            >
              <Bookmark className="w-6 h-6 fill-current shrink-0" />
              <span>⚡ KÉO NÚT NÀY THẢ LÊN THANH BOOKMARK (v10.2.51)</span>
            </a>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 text-left space-y-2">
            <div className="font-bold text-white text-[11px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>👉 3 Bước Dễ Dàng:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-xs">
              <li>Nhấn phím <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[11px]">Ctrl + Shift + B</kbd> để hiển thị thanh Bookmark trình duyệt.</li>
              <li>Dùng chuột <strong>GIỮ VÀ KÉO NÚT MÀU XANH Ở TRÊN</strong> thả lên thanh Bookmark.</li>
              <li>Mở trang bài tập EduNext: <strong className="text-emerald-400 underline">https://fsc-edunext.fpt.edu.vn/home</strong> 👉 <strong>Bấm vào Bookmark vừa kéo</strong> là AI tự hiện lên và làm bài!</li>
            </ol>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={copyBookmark}
              className="text-xs font-semibold gap-1.5"
            >
              {copiedBookmarkCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBookmarkCode ? '✓ Đã sao chép mã Bookmarklet!' : '📋 Sao Chép Mã Bookmarklet'}</span>
            </Button>
            <a
              href={`/keo_bookmark.html?key=${encodeURIComponent(licenseKey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
            >
              <span>Mở Trang Kéo Thả Riêng</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Discord Admin Contact Banner */}
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white">Cần Hỗ Trợ Kích Hoạt Hoặc Gia Hạn?</div>
              <div className="text-[11px] text-indigo-300">
                Liên hệ Discord Admin 24/7 để nhận hỗ trợ kỹ thuật hoặc gia hạn Key.
              </div>
            </div>
          </div>
          <a
            href={BANK_CONFIG.discordContactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shrink-0 shadow-sm"
          >
            <span>Nhắn Tin Discord</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Security / Encrypted Key Guarantee Banner */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span>Bảo Mật API Key & Cloud AI Proxy Độc Lập</span>
              <Badge variant="emerald" size="sm">An Toàn 100%</Badge>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Tự động vượt rào bảo mật EduNext, không cần cài Tampermonkey. Toàn bộ câu hỏi được xử lý qua máy chủ Cloud AI Proxy bảo mật.
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
