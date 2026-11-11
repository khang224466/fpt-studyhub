'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, CheckCircle2, Zap } from 'lucide-react';

export default function AiBridgePage() {
  const [status, setStatus] = useState<'waiting' | 'connected' | 'solving' | 'solved'>('waiting');
  const [logs, setLogs] = useState<string[]>(['[Khởi tạo] Cầu nối AI Bridge sẵn sàng kết nối EduNext...']);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`]);
  };

  useEffect(() => {
    // Notify opener that bridge is ready
    if (window.opener) {
      try {
        window.opener.postMessage({ type: 'ENX_BRIDGE_READY' }, '*');
        setStatus('connected');
        addLog('✓ Đã kết nối thành công với phòng học EduNext!');
      } catch (e) {
        addLog('Đang chờ kết nối từ EduNext...');
      }
    }

    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'ENX_PING') {
        setStatus('connected');
        if (event.source) {
          (event.source as Window).postMessage({ type: 'ENX_PONG' }, '*');
        }
        return;
      }

      if (data.type === 'ENX_SOLVE_REQ') {
        const { requestId, payload } = data;
        setStatus('solving');
        const hasImg = payload.images && payload.images.length > 0;
        addLog(`Nhận yêu cầu: ${hasImg ? '📸 Ảnh Vision + ' : ''}"${(payload.question || '').slice(0, 35)}..."`);

        try {
          const res = await fetch('/api/v1/ai/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const resData = await res.json();
          if (resData.success && resData.answer) {
            setStatus('solved');
            addLog(`✓ AI đã giải xong: "${resData.answer.slice(0, 30)}..." -> Đang gửi về EduNext`);
            if (event.source) {
              (event.source as Window).postMessage({
                type: 'ENX_SOLVE_RES',
                requestId,
                success: true,
                answer: resData.answer
              }, '*');
            }
          } else {
            throw new Error(resData.message || 'Lỗi từ Cloud AI Proxy');
          }
        } catch (err: any) {
          addLog(`✗ Lỗi giải: ${err.message || err}`);
          if (event.source) {
            (event.source as Window).postMessage({
              type: 'ENX_SOLVE_RES',
              requestId,
              success: false,
              error: err.message || 'Lỗi kết nối AI'
            }, '*');
          }
        } finally {
          setTimeout(() => setStatus('connected'), 2000);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Periodic ping to opener if available
    const interval = setInterval(() => {
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'ENX_BRIDGE_HEARTBEAT' }, '*');
        } catch (_) {}
      }
    }, 4000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30">
      <div className="w-full max-w-md bg-slate-900/90 border-2 border-emerald-500/60 rounded-2xl p-6 shadow-2xl shadow-emerald-950/80 space-y-4 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                <span>Cầu Nối AI EduNext (CSP Bridge)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/40">
                  v10.2.34
                </span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Vượt rào cản CSP Cloudflare 100%</span>
              </div>
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between font-medium">
            <span className="text-slate-400">Trạng thái kết nối:</span>
            <span className={`font-bold ${status === 'solving' ? 'text-cyan-400 animate-pulse' : 'text-emerald-400'}`}>
              {status === 'waiting' && '⏳ Đang chờ kết nối từ EduNext...'}
              {status === 'connected' && '🟢 Đã kết nối với EduNext'}
              {status === 'solving' && '⚡ Đang gọi Cloud AI giải bài...'}
              {status === 'solved' && '✓ Đã gửi đáp án về phòng học'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>Lưu ý:</strong> Hãy giữ cửa sổ này chạy nền trong suốt buổi học. Khi bạn làm bài trên EduNext, cửa sổ này sẽ tự động giải và truyền đáp án về phòng học!
          </p>
        </div>

        {/* Live Logs */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Nhật Ký Hoạt Động Realtime:
          </div>
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-28 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
