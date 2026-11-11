'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  ArrowRight,
  Send,
  MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BANK_CONFIG } from '@/data/servicesCatalog';

export function DemoVideoTrailer() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackTime, setPlaybackTime] = useState(0); // 0 to 28 seconds
  const activeStep = Math.min(4, Math.floor(playbackTime / 7) + 1);
  const [speed, setSpeed] = useState<number>(1);

  const totalDuration = 28; // 28s loop

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackTime(prev => {
        const next = prev + 0.2 * speed;
        if (next >= totalDuration) return 0;
        return next;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const handleSeek = (time: number) => {
    setPlaybackTime(time);
  };

  const steps = [
    { id: 1, time: 0, title: '1. Tự Động Quét Đề', desc: 'Auto Vision quét màn hình đề bài EduNext' },
    { id: 2, time: 7, title: '2. Gemini Flash-Lite Giải Bài', desc: 'AI trả lời đúng mẫu Trả lời: [...] trong 1.2s' },
    { id: 3, time: 14, title: '3. Điền React Fiber & Nộp', desc: 'Đồng bộ 5 tầng DOM và bấm Nộp 100%' },
    { id: 4, time: 21, title: '4. Vòng Lặp Auto Liên Tục', desc: 'Tự chuyển câu kế tiếp đến khi hoàn thành' }
  ];

  // Simulated content typed in textarea
  const fullAnswer = "Trả lời: Cơ chế Buffer Overflow xảy ra khi dữ liệu vượt quá kích thước bộ đệm. Để phòng ngừa hiệu quả trong môi trường hệ thống: 1. Áp dụng ASLR (Address Space Layout Randomization) để ngẫu nhiên hóa không gian địa chỉ bộ nhớ; 2. Sử dụng Stack Canary nhằm phát hiện các hành vi ghi đè con trỏ lệnh trả về trước khi mã độc được thực thi.";
  
  let streamedText = "";
  if (playbackTime >= 10 && playbackTime < 15) {
    const progress = (playbackTime - 10) / 4;
    streamedText = fullAnswer.slice(0, Math.floor(fullAnswer.length * progress));
  } else if (playbackTime >= 15) {
    streamedText = fullAnswer;
  }

  return (
    <section id="trailer" className="py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800/80 relative overflow-hidden">
      {/* Background Neon Halo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="emerald" size="md" className="mb-3">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Video Trailer Thực Nghiệm
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Xem EduNext AI Pro Tự Động Hoạt Động
          </h2>
          <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
            Mô phỏng quy trình hoạt động thực tế trên giao diện <strong>EduNext LMS</strong>. Hệ thống tự động nhận diện câu hỏi từ giáo viên, kích hoạt Gemini 2.0 Flash-Lite giải bài và nộp liên tục hoàn toàn tự động.
          </p>
        </div>

        {/* Video Player Mockup Container */}
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-slate-950 shadow-2xl shadow-emerald-950/70 overflow-hidden">
          {/* Top Browser Bar */}
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <div className="ml-3 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="text-emerald-400">🔒 https://</span>
                <span>fsc-edunext.fpt.edu.vn/home/course/class-session</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Simulation (v10.2.23)
              </span>
            </div>
          </div>

          {/* Player Screen Area */}
          <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-[#0a0f1d] overflow-hidden flex flex-col md:flex-row">
            {/* Left: Simulated EduNext Classroom */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 relative">
              {/* Question Laser Scanner Line (Active in Step 1) */}
              {activeStep === 1 && (
                <div 
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] z-20 pointer-events-none transition-all duration-300"
                  style={{ top: `${(playbackTime % 7) * 14 + 15}%` }}
                />
              )}

              {/* Chat Session Content */}
              <div className="space-y-4">
                {/* Session Title */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      FPT
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">CSD201 - Data Structures & Algorithms</div>
                      <div className="text-[10px] text-slate-400">Slot 3 • Phòng LAB 302 • GV: TS. Nguyễn Văn A</div>
                    </div>
                  </div>
                  <Badge variant="emerald" size="sm">Đang diễn ra</Badge>
                </div>

                {/* Teacher Question Bubble */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-600/30 border border-amber-500/50 flex items-center justify-center text-amber-300 font-bold text-xs shrink-0">
                    GV
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl rounded-tl-sm max-w-lg shadow-md space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400">Giảng Viên EduNext</span>
                      <span className="text-[10px] text-slate-500 font-mono">10:14 AM</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {playbackTime < 21 ? (
                        <>
                          <strong>Câu hỏi 1:</strong> Phân tích cơ chế chống tràn bộ nhớ trong Buffer Overflow và giải pháp phòng ngừa bằng ASLR & Stack Canary? Trả lời theo mẫu: <span className="text-emerald-400 font-mono font-bold">Trả lời: [đáp án]</span>
                        </>
                      ) : (
                        <>
                          <strong>Câu hỏi 2:</strong> Trình bày độ phức tạp thời gian thuật toán Dijkstra tìm đường đi ngắn nhất khi sử dụng Priority Queue (Min-Heap)?
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* AI Solving Animation Badge (Active in Step 2) */}
                {activeStep === 2 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/70 border border-emerald-500/50 px-3 py-2 rounded-xl max-w-md animate-pulse">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span>⚡ <strong>Gemini 2.0 Flash-Lite:</strong> Đang phân tích đề & trích xuất đáp án chính xác... (1.2s)</span>
                  </div>
                )}

                {/* Student Answer Bubble (Active in Step 3 & 4) */}
                {playbackTime >= 15 && (
                  <div className="flex items-start justify-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-emerald-950/60 border border-emerald-500/60 p-3.5 rounded-2xl rounded-tr-sm max-w-md shadow-md text-right space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] text-emerald-300 font-mono">✓ Đã nộp qua React Fiber</span>
                        <span className="text-[11px] font-bold text-emerald-400">Bạn (Sinh Viên)</span>
                      </div>
                      <p className="text-xs text-slate-100 text-left leading-relaxed">
                        {fullAnswer}
                      </p>
                      <div className="pt-1 text-[10px] text-emerald-400 font-bold flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Hệ thống chấm: 10/10 Điểm</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      SV
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Answer Input Box */}
              <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Khung Soạn Thảo (React 18 Fiber Textarea):</span>
                  {activeStep === 3 && (
                    <span className="text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                      <Zap className="w-3 h-3" />
                      Tự động gõ & kích hoạt onSendMessage...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="w-full h-16 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-sans text-slate-200 overflow-hidden">
                    {streamedText ? (
                      <span className="text-emerald-300 font-medium">{streamedText}</span>
                    ) : (
                      <span className="text-slate-600 italic">Nhập câu trả lời của bạn vào đây...</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500">Mẫu: Trả lời: [đáp án]</span>
                  <div className="relative">
                    <button 
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeStep === 3
                          ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/40 scale-105'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      <span>Nộp câu trả lời</span>
                      <Send className="w-3 h-3" />
                    </button>
                    {activeStep === 3 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: The Floating HUD v10.2.23 */}
            <div className="w-full md:w-80 p-4 bg-slate-950/95 flex flex-col justify-between border-t md:border-t-0 select-none">
              <div className="space-y-3">
                {/* HUD Header */}
                <div className="flex items-center justify-between pb-2 border-b border-emerald-500/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs">
                      ⚡
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                        <span>EduNext AI Pro</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/30 font-mono">
                          v10.2.23
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">Auto Loop: BẬT 100%</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">─ ✕</div>
                </div>

                {/* HUD Controls */}
                <div className="space-y-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                      <span>🔑 Bản quyền:</span>
                      <span className="text-white">Gói 1 Tháng</span>
                    </div>
                    <span className="text-emerald-400 font-mono text-[10px]">Còn 28 ngày</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Màn hình: Auto Vision</span>
                    </div>
                    <Badge variant="emerald" size="sm">Đang kết nối</Badge>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-md">
                      🎯 Chụp & Giải
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold text-xs">
                      ⚡ Auto: BẬT
                    </button>
                  </div>
                </div>

                {/* Live Console Logs */}
                <div className="p-2.5 rounded-lg bg-black border border-slate-800 font-mono text-[10px] space-y-1 h-32 overflow-hidden text-slate-400">
                  <div className="text-emerald-400">[10:14:00] EduNext AI Pro v10.2.23 sẵn sàng!</div>
                  <div className="text-slate-300">[10:14:01] Auto Loop đang chạy liên tục...</div>
                  {playbackTime >= 2 && (
                    <div className="text-cyan-400">[10:14:02] 📸 Auto Vision: Nhận diện câu hỏi mới!</div>
                  )}
                  {playbackTime >= 7 && (
                    <div className="text-emerald-400">[10:14:03] ✓ Gemini Flash-Lite trả lời (1.2s)</div>
                  )}
                  {playbackTime >= 12 && (
                    <div className="text-slate-300">[10:14:04] Đã điền React Fiber 5 tầng...</div>
                  )}
                  {playbackTime >= 15 && (
                    <div className="text-emerald-400 font-bold">[10:14:05] ✓ ĐÃ BẤM [Nộp câu trả lời] thành công!</div>
                  )}
                  {playbackTime >= 21 && (
                    <div className="text-amber-400">[10:14:08] Tự động chuyển câu tiếp theo...</div>
                  )}
                </div>
              </div>

              {/* Status Bar */}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="truncate">
                  {activeStep === 1 && "Đang quét và nhận diện đề bài..."}
                  {activeStep === 2 && "Gemini Flash-Lite đang giải bài..."}
                  {activeStep === 3 && "Đang tự động nộp câu trả lời..."}
                  {activeStep === 4 && "Đã nộp xong! Tự động chờ câu kế..."}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Player Controls & Scrubber */}
          <div className="bg-slate-900/95 p-3.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Play/Pause & Time */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors shadow-md"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button
                onClick={() => setPlaybackTime(0)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                title="Xem lại từ đầu"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="text-xs font-mono text-slate-300">
                0:{Math.floor(playbackTime).toString().padStart(2, '0')} / 0:{totalDuration}
              </div>
            </div>

            {/* Scrubber Timeline */}
            <div className="w-full sm:flex-1 mx-2">
              <input
                type="range"
                min="0"
                max={totalDuration}
                step="0.5"
                value={playbackTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Speed & Sound Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSpeed(s => s === 1 ? 2 : 1)}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold"
              >
                {speed}x
              </button>
            </div>
          </div>
        </div>

        {/* 4 Steps Interactive Selector Cards */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map(s => {
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSeek(s.time)}
                className={`p-3.5 rounded-xl text-left transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-lg shadow-emerald-950/50 scale-[1.02]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-100">{s.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {s.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h4 className="text-base sm:text-lg font-bold text-white">
              Sẵn Sàng Trải Nghiệm EduNext AI Pro v10.2.23?
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Đăng ký nhận Key bản quyền ngay để tự động hóa 100% việc làm bài tập trên lớp!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#services">
              <Button variant="primary" size="md" className="gap-2 font-bold shadow-lg shadow-emerald-950/60">
                <span>Xem Bảng Gói & Đăng Ký</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a 
              href={BANK_CONFIG.discordContactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Liên Hệ Discord Admin</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
