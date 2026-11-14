'use client';

import React, { useState } from 'react';
import { Bookmark, Sparkles, CheckCircle2, Play, RefreshCw, Zap, ShieldCheck, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { generateBookmarkletCode } from '@/lib/utils';

export function HeroSection() {
  const bmCode = generateBookmarkletCode();
  const [simStep, setSimStep] = useState<'idle' | 'clicked' | 'injected' | 'ready'>('idle');

  const triggerSim = () => {
    setSimStep('clicked');
    setTimeout(() => {
      setSimStep('injected');
      setTimeout(() => {
        setSimStep('ready');
      }, 1400);
    }, 1000);
  };

  const resetSim = () => {
    setSimStep('idle');
  };

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[130px] -z-10 pointer-events-none rounded-full" />
      <div className="absolute top-1/3 left-1/3 w-[350px] h-[250px] bg-cyan-500/10 blur-[120px] -z-10 pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Pitch */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 mb-6 shadow-inner">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">Bộ Giải Pháp Học Tập & Thi Cử Dành Riêng Sinh Viên FPT</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
            EduNext • Khảo Thí Online • SEB <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Bộ 3 Công Cụ Hỗ Trợ 1-Click
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 leading-relaxed font-normal">
            Tự động giải và khớp mẫu bài tập trên <strong>EduNext</strong> (chống 429 Rate Limit, nhận diện câu hỏi 5s), cổng luyện đề trắc nghiệm <strong>Khảo Thí Online</strong> và bộ tối ưu hóa môi trường <strong>Safe Exam Browser (SEB)</strong> mượt mà không crash.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#services">
              <Button size="lg" className="shadow-emerald-600/30 gap-2 text-base">
                <Sparkles className="w-5 h-5 text-emerald-200" />
                <span>Xem Bảng Gói & Đăng Ký Ngay</span>
              </Button>
            </a>
            <a href="#trailer">
              <Button variant="secondary" size="lg" className="gap-2 text-base">
                <Play className="w-4 h-4 text-slate-300" />
                <span>Xem Video Trailer Sử Dụng</span>
              </Button>
            </a>
          </div>

          {/* Value Props Row */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-emerald-400 font-bold text-lg">EduNext v10.2.59 PRO</div>
              <div className="text-xs text-slate-400 mt-0.5 font-medium">Auto 35s, Tiếng Anh & Việt, 7 bài/tuần</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-cyan-400 font-bold text-lg">Khảo Thí</div>
              <div className="text-xs text-slate-400 mt-0.5 font-medium">Kho đề thi thử & phân tích bẫy</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-amber-400 font-bold text-lg">SEB Toolkit</div>
              <div className="text-xs text-slate-400 mt-0.5 font-medium">Chuẩn hóa cấu hình, chống lag</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-indigo-400 font-bold text-lg">1-Click</div>
              <div className="text-xs text-slate-400 mt-0.5 font-medium">Kéo thả Bookmarklet là chạy</div>
            </div>
          </div>
        </div>

        {/* Interactive Browser & Bookmarklet Simulator */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
            {/* Fake Chrome Titlebar */}
            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-xs font-mono text-slate-400">Google Chrome — FSC EduNext FPT</span>
              </div>
              <div className="text-xs font-medium text-slate-500 hidden sm:block">Trình mô phỏng trực tiếp</div>
            </div>

            {/* Fake Chrome Address Bar & Bookmarks Bar */}
            <div className="bg-slate-900/70 p-3 border-b border-slate-800/80 space-y-2.5">
              {/* URL */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-semibold">https://</span>
                <span className="text-white">fsc-edunext.fpt.edu.vn</span>
                <span className="text-slate-500">/course/hoa-hoc-10/bai-2</span>
              </div>

              {/* Bookmarks Bar */}
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300 overflow-x-auto py-0.5">
                <span className="text-slate-500 text-[11px] shrink-0">Thanh Dấu Trang:</span>
                
                {/* The Magic Bookmarklet Button */}
                <button
                  onClick={triggerSim}
                  disabled={simStep !== 'idle' && simStep !== 'ready'}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-semibold shadow-md shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0 border border-emerald-400/30 animate-pulse"
                >
                  <Bookmark className="w-3.5 h-3.5 fill-current" />
                  <span>⚡ Kích Hoạt EduNext Assistant v10.2.59 PRO</span>
                </button>

                <div className="px-2.5 py-1 rounded bg-slate-800/60 text-slate-400 text-xs shrink-0 flex items-center gap-1">
                  <span>Khảo Thí FPT</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-slate-800/60 text-slate-400 text-xs shrink-0 flex items-center gap-1">
                  <span>SEB Config</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-slate-800/60 text-slate-400 text-xs shrink-0 flex items-center gap-1">
                  <span>FLM Portal</span>
                </div>

                <div className="ml-auto">
                  {simStep !== 'idle' && (
                    <button 
                      onClick={resetSim}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 underline underline-offset-2"
                    >
                      <RefreshCw className="w-3 h-3" /> Thử lại
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Web Content Simulation Area */}
            <div className="relative min-h-[340px] bg-[#0c101c] p-6 sm:p-8 flex flex-col justify-between">
              {/* Web Page Top Header */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">FPT EduNext Assistant Pro</div>
                    <div className="text-xs text-slate-400">
                      {simStep === 'ready' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 inline" /> Đã kết nối v10.2.59 PRO (Vision 5s, Dual 429 Interceptor, Template Matcher)
                        </span>
                      ) : (
                        <span>Chưa kích hoạt trợ lý học tập</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {simStep === 'ready' ? (
                    <Badge variant="emerald" size="md">Auto Solver: ON</Badge>
                  ) : (
                    <Badge variant="slate" size="md">Chưa Kích Hoạt</Badge>
                  )}
                </div>
              </div>

              {/* Chat Content Body */}
              <div className="my-6 space-y-4 max-w-xl mx-auto w-full">
                {simStep === 'idle' && (
                  <div className="text-center py-6">
                    <p className="text-slate-400 text-sm mb-3">
                      👉 Hãy bấm vào nút <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">⚡ Kích Hoạt EduNext Assistant v10.2.59 PRO</span> trên thanh dấu trang ở trên!
                    </p>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-left font-mono">
                      // Đề bài: "Đối với đồng vị carbon-14, số hiệu nguyên tử Z=6 và số khối A=14..."<br />
                      // Yêu cầu mẫu: "Trả lời: [đáp án của bạn]"<br />
                      // Trạng thái: Đang chờ lệnh kích hoạt.
                    </div>
                  </div>
                )}

                {simStep === 'ready' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/40 text-xs text-slate-200 space-y-2">
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> EduNext Assistant v10.2.59 PRO đã xử lý thành công:
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-emerald-300">
                        &gt; Tự động điền đáp án chuẩn mẫu: <strong>Trả lời: 8</strong><br />
                        &gt; Dual Interceptor: Đã chặn triệt để bão click và lỗi HTTP 429.<br />
                        &gt; Bot AI EduNext: Đã chấm đạt 100%!
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Injected Floating HUD Simulator */}
              {simStep !== 'idle' && (
                <div className="absolute top-4 right-4 z-20 w-80 rounded-xl bg-slate-950/95 border border-cyan-500/50 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 tracking-wider">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>EDUNEXT HUD v10.2.59 PRO</span>
                    </div>
                    {simStep === 'clicked' && <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />}
                    {simStep === 'injected' && <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
                    {simStep === 'ready' && <span className="text-emerald-400 font-bold text-sm">✓</span>}
                  </div>

                  {simStep === 'clicked' && (
                    <div>
                      <div className="text-xs font-semibold text-white">Đang kiểm tra License FPT...</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Xác thực mã sinh viên và nạp bản quyền v10.2.59 PRO</div>
                    </div>
                  )}

                  {simStep === 'injected' && (
                    <div>
                      <div className="text-xs font-semibold text-emerald-400">Bản Quyền Hợp Lệ!</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">Khởi động bộ quét Vision 5s và Dual 429 Guard...</div>
                    </div>
                  )}

                  {simStep === 'ready' && (
                    <div>
                      <div className="text-xs font-semibold text-emerald-400">Sẵn Sàng Hỗ Trợ!</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">Tự động điền bài và vượt qua hộp Làm Rõ Ý Định.</div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Composer Simulator */}
              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <span>Hỗ trợ chuẩn fsc-edunext.fpt.edu.vn • khaothionline • SEB</span>
                <span className="font-mono">Ping: 12ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
