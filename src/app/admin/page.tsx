'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Users, 
  DollarSign, 
  Key, 
  Server, 
  Plus, 
  Copy, 
  Check, 
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Clock,
  Sparkles,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatVND } from '@/lib/utils';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';

export default function AdminPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState('7');
  const [customApiKey, setCustomApiKey] = useState('');
  const [lastGenerated, setLastGenerated] = useState<{
    key: string;
    planLabel: string;
    expDate: string;
    days: number;
  } | null>(null);

  const [generatedKeys, setGeneratedKeys] = useState([
    { key: 'DEMO-EDUNEXT-2026', service: 'FPT EduNext AI Assistant Pro', plan: '1 Kỳ Học', expDate: '11/07/2026', status: 'active', users: 18 },
    { key: 'VIP-EDUNEXT-1MONTH', service: 'FPT EduNext AI Assistant Pro', plan: '1 Tháng', expDate: '11/04/2026', status: 'active', users: 9 },
    { key: 'VIP-EDUNEXT-1WEEK', service: 'FPT EduNext AI Assistant Pro', plan: '1 Tuần', expDate: '18/03/2026', status: 'active', users: 12 }
  ]);

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(durationDays, 10);
    let planLabel = '1 Tuần';
    if (days === 30) planLabel = '1 Tháng';
    if (days === 120) planLabel = '1 Kỳ Học (4 Tháng)';

    const rawKey = customApiKey.trim() || 'AIzaSyFPT_PRO_STUDYHUB_KEY';
    const expiresAt = Date.now() + days * 24 * 3600 * 1000;
    const payload = `EXP|${expiresAt}|${planLabel}|${rawKey}`;
    const salt = 'ENX_SEC_2026_FLASH_LITE';

    let hex = '';
    for (let i = 0; i < payload.length; i++) {
      const c = payload.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
      hex += c.toString(16).padStart(2, '0');
    }
    const b64 = btoa(hex);
    const encKey = `ENC_AI_${b64}`;
    const expDateStr = new Date(expiresAt).toLocaleDateString('vi-VN') + ' ' + new Date(expiresAt).toLocaleTimeString('vi-VN');

    setLastGenerated({
      key: encKey,
      planLabel,
      expDate: expDateStr,
      days
    });

    setGeneratedKeys(prev => [
      {
        key: encKey,
        service: 'FPT EduNext AI Assistant Pro (v10.2.19)',
        plan: planLabel,
        expDate: expDateStr,
        status: 'active',
        users: 0
      },
      ...prev
    ]);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const accountPools = [
    { service: 'EduNext VIP Assistant Pool (v10.2.19)', accounts: 8, capacity: '280/300 slots', health: 'healthy', latency: '12ms' },
    { service: 'Khảo Thí Online Exam Bank Pool (Sắp ra mắt)', accounts: 4, capacity: 'Chờ kiểm thử', health: 'healthy', latency: '18ms' },
    { service: 'Safe Exam Browser Config Cloud Node (Sắp ra mắt)', accounts: 3, capacity: 'Chờ kiểm thử', health: 'healthy', latency: '9ms' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại trang chủ FPT Study Hub</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Admin Console — FPT Academic Hub
              </h1>
              <Badge variant="indigo" size="sm">Bản v10.2.19 (EduNext Pro)</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Admin: <strong>{BANK_CONFIG.accountName}</strong> • MBBank: <strong className="font-mono text-emerald-400">{BANK_CONFIG.accountNo}</strong> • Discord: <a href={BANK_CONFIG.discordContactUrl} target="_blank" className="text-indigo-400 underline">888713971161505832</a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Làm mới số liệu</span>
            </Button>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Tổng Khách Hàng Đã Cấp</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">3,820</div>
            <div className="text-[11px] text-emerald-400 mt-1">99.8% giải bài tự động thành công</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Doanh Thu Tích Lũy</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">42.850.000 ₫</div>
            <div className="text-[11px] text-cyan-400 mt-1">Chuyển khoản MBBank 151010042005</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Key Đang Hiệu Lực</span>
              <Key className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">1,240</div>
            <div className="text-[11px] text-amber-400 mt-1">Tự động hết hạn sau 1w / 1m / 1 kỳ</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Server Latency FPT GW</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">12ms</div>
            <div className="text-[11px] text-slate-400 mt-1">Gemini Flash-Lite: Siêu tốc 1.2s</div>
          </div>
        </div>

        {/* Section 2: License Key Generator (With Expiration) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator Form */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tạo Key Mã Hóa Có Thời Hạn (ENC_AI_...)</span>
            </h3>

            <form onSubmit={handleGenerateKey} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Hệ thống áp dụng:</label>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-semibold flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  <span>FPT EduNext AI Assistant Pro (v10.2.19)</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Chọn Thời Hạn Bản Quyền:</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="7">1 Tuần (7 Ngày) — Gói 30.000₫</option>
                  <option value="30">1 Tháng (30 Ngày) — Gói 69.000₫</option>
                  <option value="120">1 Kỳ Học (4 Tháng / 120 Ngày) — Gói 220.000₫</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">API Key Gemini nạp vào (Tùy chọn):</label>
                <input
                  type="text"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Để trống sẽ dùng Key mặc định của hệ thống"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500 text-[11px]"
                />
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full mt-2 font-bold gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Mã Hóa & Tạo Key Gửi Khách Ngay</span>
              </Button>
            </form>

            {/* Generated Output Card */}
            {lastGenerated && (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/60 space-y-2 mt-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-300">✓ Đã Tạo Key Thành Công!</span>
                  <Badge variant="emerald" size="sm">{lastGenerated.planLabel}</Badge>
                </div>
                <div className="text-[11px] text-slate-300">
                  Hạn dùng đến: <strong className="text-white font-mono">{lastGenerated.expDate}</strong>
                </div>
                <div className="p-2 rounded bg-black/60 border border-slate-800 font-mono text-[10px] text-emerald-400 break-all select-all">
                  {lastGenerated.key}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(lastGenerated.key)}
                  className="w-full text-xs font-semibold gap-1.5"
                >
                  {copiedKey === lastGenerated.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === lastGenerated.key ? 'Đã sao chép Key!' : 'Sao chép Key gửi khách trên Discord'}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Key List Table */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>Danh Sách Key Bản Quyền Đã Cấp</span>
                </h3>
                <span className="text-xs text-slate-400">Hiển thị {generatedKeys.length} keys</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Mã Key Bản Quyền</th>
                      <th className="p-2.5">Gói & Thời Hạn</th>
                      <th className="p-2.5">Ngày Hết Hạn</th>
                      <th className="p-2.5">Trạng Thái</th>
                      <th className="p-2.5 rounded-r-lg text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {generatedKeys.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-emerald-400 max-w-[200px] truncate">
                          {item.key}
                        </td>
                        <td className="p-2.5 text-slate-300 font-sans">{item.plan}</td>
                        <td className="p-2.5 text-slate-400">{item.expDate}</td>
                        <td className="p-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Hiệu Lực
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-sans">
                          <button
                            onClick={() => handleCopy(item.key)}
                            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            {copiedKey === item.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedKey === item.key ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Hỗ trợ kỹ thuật: DIEP DAI PHU</span>
              <a
                href={BANK_CONFIG.discordContactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discord Admin (888713971161505832)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
