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
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatVND } from '@/lib/utils';
import { SERVICES_CATALOG } from '@/data/servicesCatalog';

export default function AdminPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState('edunext-assistant');
  const [durationHours, setDurationHours] = useState('2880');
  const [customKeyName, setCustomKeyName] = useState('');

  const [generatedKeys, setGeneratedKeys] = useState([
    { key: 'DEMO-EDUNEXT-2026', service: 'FPT EduNext AI Assistant Pro', hours: 2880, status: 'active', users: 18 },
    { key: 'DEMO-KHAOTHI-2026', service: 'FPT Khảo Thí Online — Đề Thi Thử', hours: 2880, status: 'active', users: 9 },
    { key: 'DEMO-SEB-2026', service: 'Safe Exam Browser (SEB) Toolkit', hours: 720, status: 'active', users: 12 }
  ]);

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const serviceObj = SERVICES_CATALOG.find(s => s.id === selectedService);
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newKey = customKeyName.trim()
      ? customKeyName.trim().toUpperCase()
      : `KEY-${selectedService.slice(0, 4).toUpperCase()}-${randomSuffix}`;

    setGeneratedKeys(prev => [
      {
        key: newKey,
        service: serviceObj?.name || selectedService,
        hours: parseInt(durationHours, 10),
        status: 'active',
        users: 0
      },
      ...prev
    ]);
    setCustomKeyName('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const accountPools = [
    { service: 'EduNext VIP Assistant Pool (v10.2.15)', accounts: 6, capacity: '240/300 slots', health: 'healthy', latency: '12ms' },
    { service: 'Khảo Thí Online Exam Bank Pool', accounts: 4, capacity: '150/200 slots', health: 'healthy', latency: '18ms' },
    { service: 'Safe Exam Browser Config Cloud Node', accounts: 3, capacity: '90/100 slots', health: 'healthy', latency: '9ms' }
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
              <Badge variant="indigo" size="sm">Bản v2.4 (EduNext/Khảo Thí/SEB)</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quản trị License sinh viên FPT, giám sát tải server EduNext Assistant v10.2.15, Khảo Thí và SEB Toolkit.
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Doanh Thu Hôm Nay</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">1.820.000₫</div>
            <div className="text-[11px] text-emerald-400 mt-1">↑ +38% sinh viên đăng ký</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Đơn Hàng Kì Học</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">42 Gói</div>
            <div className="text-[11px] text-cyan-400 mt-1">EduNext & Khảo Thí chiếm 88%</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>License Đang Hoạt Động</span>
              <Key className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">156 Key</div>
            <div className="text-[11px] text-indigo-400 mt-1">0 lỗi xung đột session</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Server Latency FPT GW</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">12ms</div>
            <div className="text-[11px] text-slate-400 mt-1">Dual 429 Guard: Active</div>
          </div>
        </div>

        {/* Section 2: Account Session Pools Status */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Trạng Thái Cụm Node Server (EduNext • Khảo Thí • SEB)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các node phân phối token và cấu hình cho sinh viên qua Bookmarklet.
              </p>
            </div>
            <Badge variant="emerald" size="sm">3/3 Cụm Online</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accountPools.map((pool, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white text-xs">{pool.service}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {pool.accounts} nodes • Tải: {pool.capacity}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="emerald" size="sm">Hoạt Động</Badge>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">{pool.latency}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: License Key Generator & Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator Form */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tạo License Key FPT Mới</span>
            </h3>

            <form onSubmit={handleGenerateKey} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Hệ thống:</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                >
                  {SERVICES_CATALOG.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Thời hạn:</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="168">1 Tuần (168 Giờ)</option>
                  <option value="720">1 Tháng (720 Giờ)</option>
                  <option value="2880">1 Kì Học 4 Tháng (2880 Giờ)</option>
                  <option value="8760">1 Năm Học (8760 Giờ)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Mã License tùy chỉnh (Tùy chọn):</label>
                <input
                  type="text"
                  value={customKeyName}
                  onChange={(e) => setCustomKeyName(e.target.value)}
                  placeholder="Ví dụ: FPT-EDUNEXT-K19"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full mt-2">
                <span>Tạo License Ngay</span>
              </Button>
            </form>
          </div>

          {/* Key List */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>Danh Sách License Key Đang Hoạt Động</span>
                </h3>
                <span className="text-xs text-slate-400">{generatedKeys.length} keys</span>
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {generatedKeys.map((k, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-emerald-400">{k.key}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {k.service} • {k.hours >= 720 ? `${Math.round(k.hours / 720)} tháng` : `${k.hours}h`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="emerald" size="sm">Đang Chạy</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(k.key)}
                        className="py-1 px-2.5 h-auto text-xs"
                      >
                        {copiedKey === k.key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
              * Sinh viên có thể dùng các License Key này để kích hoạt trực tiếp trên trang chủ hoặc trang Tra Cứu.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
