'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Key, 
  Search, 
  Bookmark, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowLeft,
  Zap,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { generateBookmarkletCode } from '@/lib/utils';
import { SERVICES_CATALOG } from '@/data/servicesCatalog';

export default function ActivatePage() {
  const [searchKey, setSearchKey] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKey.trim()) return;

    setIsSearching(true);
    setErrorMsg('');
    setSearchResult(null);

    try {
      const key = searchKey.trim();

      const res = await fetch('/api/v1/auth/session-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, domain: 'fsc-edunext.fpt.edu.vn' })
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || 'Mã License không tồn tại hoặc đã hết hạn.');
        return;
      }

      const service = SERVICES_CATALOG.find(s => s.name === data.serviceName) || SERVICES_CATALOG[0];

      setSearchResult({
        key,
        service,
        status: 'active',
        remainingTime: data.remainingTime,
        expiresAt: new Date(data.expiresAt).toLocaleString('vi-VN'),
        isTrial: data.isTrial,
        activatedAt: new Date().toLocaleString('vi-VN')
      });
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setIsSearching(false);
    }
  };

  const bookmarkletJs = searchResult
    ? generateBookmarkletCode(searchResult.key, typeof window !== 'undefined' ? window.location.origin : 'https://passshare.vercel.app')
    : '';

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://passshare.vercel.app';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 sm:py-16 w-full">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại trang chủ</span>
          </Link>
        </div>

        {/* Page Title */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-inner">
            <Key className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Tra Cứu & Nhận Bookmarklet Dịch Vụ
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Nhập mã License Key bạn đã nhận được sau khi thanh toán hoặc đăng ký dùng thử để kiểm tra hạn sử dụng và lấy nút kích hoạt 1-Click.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="max-w-xl mx-auto">
          <form onSubmit={handleLookup} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                placeholder="Nhập mã (Ví dụ: TRIAL-EDUNEXT-2H-... hoặc DEMO-EDUNEXT-2026)"
                className="w-full pl-11 pr-28 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                disabled={isSearching || !searchKey.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSearching ? 'Đang tra...' : 'Tra Cứu'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Hỗ trợ các mã TRIAL, KEY hoặc DEMO</span>
              <button
                type="button"
                onClick={() => setSearchKey('DEMO-EDUNEXT-2026')}
                className="text-emerald-400 hover:underline"
              >
                Dán mã mẫu
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Lookup Results Card */}
        {searchResult && (
          <div className="mt-8 rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Status Header */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{searchResult.service.name}</h3>
                  <div className="text-xs text-slate-400">
                    Trạng thái: {searchResult.isTrial ? 'Gói Dùng Thử 2 Giờ (0₫)' : 'Bản quyền hợp lệ'}
                  </div>
                </div>
              </div>
              <Badge variant="emerald" size="md">{searchResult.isTrial ? 'Trial 2H' : 'Online'}</Badge>
            </div>

            {/* Timing Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Thời hạn còn lại:</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{searchResult.remainingTime}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Hết hạn vào:</div>
                <div className="text-xs font-medium text-slate-300 mt-1">{searchResult.expiresAt}</div>
              </div>
            </div>

            {/* DRAGGABLE BUTTON BOX */}
            <div className="p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-emerald-500/50 text-center space-y-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-left text-amber-200 text-xs">
                ⚠️ <strong>Lưu ý Windows:</strong> Chrome chặn kéo thả liên kết dài (hiện biểu tượng 🚫). Hãy bấm <strong>Sao Chép Mã</strong> &rarr; Chuột phải thanh Bookmark &rarr; Thêm trang &rarr; Dán URL!
              </div>

              <div className="py-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bookmarkletJs);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/80 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-400/40 select-none"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? '✓ Đã sao chép mã! Hãy chuột phải Bookmark và dán' : `📋 Bấm Sao Chép Mã ${searchResult.service.name} (v10.2.62 PRO)`}</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <a
                  href={`${origin}/keo_bookmark.html?key=${encodeURIComponent(searchResult.key)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Trang Hướng Dẫn Riêng</span>
                </a>
                <a
                  href={`${origin}/edunext.user.js?key=${encodeURIComponent(searchResult.key)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cài Tampermonkey (v10.2.62 PRO)</span>
                </a>
              </div>
            </div>

            {/* Instruction Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cách Sử Dụng Đơn Giản:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Bấm nút <strong>Sao Chép Mã</strong> ở trên</li>
                <li>Chuột phải lên thanh Bookmark trình duyệt (Ctrl+Shift+B) &rarr; Chọn <strong>Thêm trang...</strong> &rarr; Dán vào ô URL</li>
                <li>Truy cập vào trang học tập: <strong>https://{searchResult.service.targetDomain}</strong></li>
                <li>Nhấn vào nút Bookmark vừa tạo &rarr; Bảng điều khiển HUD <strong>v10.2.62 PRO</strong> sẽ xuất hiện, tự động giải bài và nộp theo mẫu 35s!</li>
              </ol>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
