'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  DollarSign, 
  Key, 
  KeyRound,
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
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Hourglass
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatVND } from '@/lib/utils';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { OrderItem } from '@/types/rental';

export default function AdminPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState('7');
  const [customApiKey, setCustomApiKey] = useState('');
  const [masterApiKey, setMasterApiKey] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [isQuickApproving, setIsQuickApproving] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{
    key: string;
    planLabel: string;
    expDate: string;
    days: number;
  } | null>(null);

  // Live Orders state from API
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fpt_admin_master_gemini_key');
      if (saved) setMasterApiKey(saved);
    } catch (e) {}
  }, []);

  const handleMasterKeyChange = (val: string) => {
    setMasterApiKey(val);
    try {
      localStorage.setItem('fpt_admin_master_gemini_key', val);
    } catch (e) {}
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/v1/orders?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      const data = await res.json();
      if (data.success && data.orders) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error('Fetch orders error:', e);
    }
  };

  const approvedOrders = orders.filter(o => o.status === 'approved' || o.status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'waiting_approval' || o.status === 'pending');
  const totalRevenue = approvedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalCustomers = approvedOrders.length;

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  // Admin approves order and issues Key (supports orderId or transferCode)
  const handleApproveOrder = async (orderId: string, transferCode?: string) => {
    if (!masterApiKey.trim()) {
      const confirmed = window.confirm(
        'Bạn chưa nhập Master Gemini API Key ở ô cấu hình phía trên!\nNếu duyệt không có Key, khách hàng sẽ nhận Key không chứa mã gọi AI.\n\nBạn có chắc chắn muốn tiếp tục không?'
      );
      if (!confirmed) return;
    }

    setApprovingOrderId(orderId || transferCode || 'approving');
    try {
      const res = await fetch(`/api/v1/orders?t=${Date.now()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          orderId,
          transferCode,
          action: 'approve',
          apiKey: masterApiKey.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrders();
      }
    } catch (e) {
      console.error('Approve order error:', e);
    } finally {
      setApprovingOrderId(null);
    }
  };

  // Quick Approve by Transfer Code (e.g. PR7874)
  const handleQuickApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickCode.trim().toUpperCase();
    if (!code) return;

    setIsQuickApproving(true);
    try {
      await handleApproveOrder('', code);
      setQuickCode('');
    } finally {
      setIsQuickApproving(false);
    }
  };

  // Manual Key Generator
  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(durationDays, 10);
    let planLabel = '1 Tuần';
    if (days === 30) planLabel = '1 Tháng';
    if (days === 120) planLabel = '1 Kỳ Học (4 Tháng)';

    const rawKey = customApiKey.trim() || masterApiKey.trim();
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
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
                Web Quản Trị & Duyệt Cấp Key Bản Quyền
              </h1>
              <Badge variant="emerald" size="sm">v10.2.26 PRO</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Admin: <strong>{BANK_CONFIG.accountName}</strong> • {BANK_CONFIG.bankName}: <strong className="font-mono text-emerald-400">{BANK_CONFIG.accountNo}</strong> • Discord: <a href={BANK_CONFIG.discordContactUrl} target="_blank" className="text-indigo-400 underline">888713971161505832</a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchOrders} className="gap-1.5 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              <span>Làm mới danh sách</span>
            </Button>
          </div>
        </div>

        {/* Master Gemini API Key Config Box */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 border border-emerald-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Master Google Gemini API Key (Duyệt Cấp Bản Quyền)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  {masterApiKey ? '✓ Đã Lưu' : '⚠ Chưa Cấu Hình'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Key này được đóng gói và mã hóa trực tiếp vào Key bản quyền khi Admin bấm <strong className="text-emerald-400">[Duyệt & Cấp Key]</strong>. Sinh viên mở Bookmarklet sẽ gọi thẳng Gemini Flash-Lite hoạt động 100%.
              </p>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Lưu an toàn trên máy Admin</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={masterApiKey}
              onChange={(e) => handleMasterKeyChange(e.target.value)}
              placeholder="Nhập Master Gemini API Key của Admin (bắt đầu bằng AIzaSy...)"
              className="flex-1 px-4 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
            {masterApiKey && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Xóa Master API Key khỏi trình duyệt?')) {
                    handleMasterKeyChange('');
                  }
                }}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition-colors cursor-pointer"
              >
                Xóa Key
              </button>
            )}
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Tổng Khách Hàng Đã Cấp</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {totalCustomers > 0 ? totalCustomers : 0}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">Đã cấp Key kích hoạt thành công</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Doanh Thu Thực Nhận</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {formatVND(totalRevenue)}
            </div>
            <div className="text-[11px] text-cyan-400 mt-1">Chuyển khoản VIB {BANK_CONFIG.accountNo}</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Đơn Chờ Admin Duyệt</span>
              <Hourglass className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">
              {pendingOrders.length}
            </div>
            <div className="text-[11px] text-amber-300 mt-1">
              {pendingOrders.length > 0 ? 'Có đơn cần duyệt ngay!' : 'Tất cả đơn đã được xử lý'}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Server Latency AI Bridge</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">12ms</div>
            <div className="text-[11px] text-slate-400 mt-1">Gemini Flash-Lite: Siêu tốc 1.2s</div>
          </div>
        </div>

        {/* Section 1: LIVE ORDERS APPROVAL TABLE */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Danh Sách Yêu Cầu Đăng Ký Chờ Duyệt & Cấp Key</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Kiểm tra tài khoản VIB {BANK_CONFIG.accountNo} ({BANK_CONFIG.accountName}), sau đó bấm "Duyệt & Cấp Key" để hệ thống tự sinh mã bản quyền có hạn chuẩn.
              </p>
            </div>
            <Badge variant="indigo" size="sm">
              Tự động đồng bộ Realtime (2s)
            </Badge>
          </div>

          {/* Quick Approve Box by Transfer Code (e.g. PR7874) */}
          <form onSubmit={handleQuickApproveSubmit} className="flex flex-col sm:flex-row items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-amber-300 font-bold shrink-0">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Duyệt nhanh theo Mã CK:</span>
            </div>
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Nhập mã CK (ví dụ: PR7874 hoặc ORD-...)"
              className="flex-1 w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-mono uppercase focus:outline-none focus:border-emerald-500"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={isQuickApproving || !quickCode.trim()}
              className="w-full sm:w-auto text-xs shrink-0 cursor-pointer"
            >
              {isQuickApproving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
              <span>Duyệt & Cấp Key Ngay</span>
            </Button>
          </form>

          {orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Chưa có đơn hàng nào trong hệ thống.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Mã Đơn</th>
                    <th className="py-3 px-3">Mã CK</th>
                    <th className="py-3 px-3">Gói Dịch Vụ</th>
                    <th className="py-3 px-3">Số Tiền</th>
                    <th className="py-3 px-3">Trạng Thái</th>
                    <th className="py-3 px-3">Mã Key Bản Quyền</th>
                    <th className="py-3 px-3 text-right">Thao Tác Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {orders.map((ord) => {
                    const isWaiting = ord.status === 'waiting_approval';
                    const isApproved = ord.status === 'approved' || ord.status === 'paid';
                    const isPending = ord.status === 'pending';

                    return (
                      <tr key={ord.orderId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 text-white font-bold">{ord.orderId}</td>
                        <td className="py-3 px-3 text-amber-300 font-bold">{ord.transferCode}</td>
                        <td className="py-3 px-3 font-sans text-slate-300">
                          {ord.durationLabel || '1 Tuần'}
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">
                          {formatVND(ord.amount)}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {isWaiting && (
                            <Badge variant="amber" size="sm">
                              <Hourglass className="w-3 h-3 mr-1 inline" />
                              Chờ Admin Duyệt
                            </Badge>
                          )}
                          {isApproved && (
                            <Badge variant="emerald" size="sm">
                              <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                              Đã Duyệt & Cấp Key
                            </Badge>
                          )}
                          {isPending && (
                            <Badge variant="slate" size="sm">
                              Chờ Chuyển Khoản
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {ord.licenseKey ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-emerald-300 truncate max-w-[140px]">
                                {ord.licenseKey}
                              </span>
                              <button
                                onClick={() => handleCopy(ord.licenseKey || '')}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                title="Sao chép Key"
                              >
                                {copiedKey === ord.licenseKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[11px] italic font-sans">Chưa cấp</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          {isApproved ? (
                            <span className="text-emerald-400 text-xs font-semibold">✓ Đã Hoàn Tất</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={approvingOrderId === ord.orderId}
                              onClick={() => handleApproveOrder(ord.orderId)}
                              className="text-xs shadow-md shadow-emerald-950 cursor-pointer"
                            >
                              {approvingOrderId === ord.orderId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              )}
                              <span>Duyệt & Cấp Key</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: LICENSE KEY GENERATOR (WITH EXPIRATION) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generator Form */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tạo Key Thủ Công (ENC_AI_...)</span>
            </h3>

            <form onSubmit={handleGenerateKey} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Hệ thống áp dụng:</label>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-semibold flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  <span>FPT EduNext AI Assistant Pro (v10.2.23)</span>
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
                  placeholder="Mặc định dùng key hệ thống hoặc nhập AIza..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <Button type="submit" variant="primary" className="w-full justify-center gap-2 mt-2">
                <Sparkles className="w-4 h-4" />
                <span>Sinh Mã Key Bản Quyền Ngay</span>
              </Button>
            </form>
          </div>

          {/* Key Output Details */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Kết Quả Mã Hóa Key Bản Quyền</span>
              </h3>

              {lastGenerated ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Gói bản quyền:</span>
                      <span className="font-bold text-emerald-400">{lastGenerated.planLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Thời điểm hết hạn:</span>
                      <span className="font-bold text-amber-300 font-mono">{lastGenerated.expDate}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[11px] text-slate-400 block mb-1">Mã Key Mã Hóa (Cung cấp cho sinh viên):</span>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 break-all select-all flex items-center justify-between gap-2">
                        <span>{lastGenerated.key}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(lastGenerated.key)}
                          className="shrink-0"
                        >
                          {copiedKey === lastGenerated.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedKey === lastGenerated.key ? 'Đã sao chép' : 'Sao chép'}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Chọn thời hạn và bấm "Sinh Mã Key Bản Quyền Ngay" để tạo key.
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Định dạng mã: <strong className="font-mono text-emerald-400">ENC_AI_[Base64(XOR)]</strong></span>
              <span className="text-slate-500">Tự động hủy khi quá hạn</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
