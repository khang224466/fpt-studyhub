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
  AlertTriangle,
  Calendar,
  Timer,
  Trash2,
  ExternalLink,
  Hourglass
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatVND } from '@/lib/utils';
import { SERVICES_CATALOG, BANK_CONFIG } from '@/data/servicesCatalog';
import { OrderItem } from '@/types/rental';
import { parseClientLicense } from '@/lib/clientLicense';

const ENCRYPTED_DEFAULT_TOKEN = 'ENC_AI_MDAxNjA4MjM2MjdkNzM2YjA1MDcwMzA3NmM3NDc1NzY2MzM0NmU2YzAyMmQ2NTBkMjEzYjdmN2I3MTYzMGI1YTUxNWM1MTc2M2EwZDEwN2QwOTNkNzQxYjFhNzMwYzdlMmIyNzJhMjI3YjFhNDU1ODQ0NzUxNTJmM2YyNjYxMGYzMTBkMWYxMDc0MDI3YzA5MGYxZjcwMzUwNzYxNGE1NjRmM2IzYzM4Mjk3ZTcxM2EzYzJl';

export default function AdminPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [durationDays, setDurationDays] = useState('7');
  const [customApiKey, setCustomApiKey] = useState('');
  const [masterApiKey, setMasterApiKey] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [isQuickApproving, setIsQuickApproving] = useState(false);
  const [extendingOrderId, setExtendingOrderId] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState<'all' | 'warning' | 'active' | 'expired'>('all');
  const [lastGenerated, setLastGenerated] = useState<{
    key: string;
    planLabel: string;
    expDate: string;
    days: number;
  } | null>(null);

  // Built-in Seed Orders so admin dashboard is NEVER blank even after server cold-restart
  const DEFAULT_INITIAL_ORDERS: OrderItem[] = [
    {
      orderId: 'ORD-8887-SEMESTER-VIP',
      serviceId: 'edunext-assistant',
      serviceName: 'FPT EduNext AI Assistant Pro',
      planId: 'edunext-semester',
      durationLabel: '1 Kỳ Học (4 Tháng)',
      durationDays: 120,
      amount: 220000,
      transferCode: 'PR7874',
      status: 'approved',
      createdAt: 1763085600000,
      paidAt: 1763085660000,
      expiresAt: 1804990888514,
      licenseKey: 'ENC_AI_MDAxNjA4MjM2MjdkNzM2YjA1MDcwMzA3NmM3NDc1NzY2MzM0NmU2YzAyMmQ2NTBkMjEzYjdmN2I3MTYzMGI1YTUxNWM1MTc2M2EwZDEwN2QwOTNkNzQxYjFhNzMwYzdlMmIyNzJhMjI3YjFhNDU1ODQ0NzUxNTJmM2YyNjYxMGYzMTBkMWYxMDc0MDI3YzA5MGYxZjcwMzUwNzYxNGE1NjRmM2IzYzM4Mjk3ZTcxM2EzYzJl'
    }
  ];

  // Live Orders state from API + LocalStorage Persistent Backup
  const [orders, setOrders] = useState<OrderItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('fpt_admin_persisted_orders_v10');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_INITIAL_ORDERS;
  });
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
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`/api/v1/orders?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(prevOrders => {
          const orderMap = new Map<string, OrderItem>();

          // 1. Initial seeds
          for (const s of DEFAULT_INITIAL_ORDERS) {
            orderMap.set(s.orderId, s);
          }

          // 2. LocalStorage orders
          try {
            const rawStored = localStorage.getItem('fpt_admin_persisted_orders_v10');
            if (rawStored) {
              const parsed = JSON.parse(rawStored);
              if (Array.isArray(parsed)) {
                for (const ord of parsed) {
                  if (ord && ord.orderId) orderMap.set(ord.orderId, ord);
                }
              }
            }
          } catch {}

          // 3. React state orders
          for (const ord of prevOrders) {
            if (ord && ord.orderId) orderMap.set(ord.orderId, ord);
          }

          // 4. Server orders (overlay latest server status)
          for (const ord of data.orders) {
            if (ord && ord.orderId) orderMap.set(ord.orderId, ord);
          }

          const merged = Array.from(orderMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          try {
            localStorage.setItem('fpt_admin_persisted_orders_v10', JSON.stringify(merged));
          } catch {}

          // If server was cold-rebooted and has fewer orders than our merged state,
          // sync back to server so server memory stays intact
          if (data.orders.length < merged.length) {
            fetch('/api/v1/orders', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'sync_bulk', orders: merged })
            }).catch(() => {});
          }

          return merged;
        });
      }
    } catch (e) {
      console.error('Fetch orders error:', e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const approvedOrders = orders.filter(o => o.status === 'approved' || o.status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'waiting_approval' || o.status === 'pending');
  const totalRevenue = approvedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalCustomers = approvedOrders.length;

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 1500);

    // Instant Realtime sync from Customer Checkout Modal (0ms)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('fpt_studyhub_orders');
        bc.onmessage = (event) => {
          const data = event.data;
          if (data && (data.type === 'ORDER_PENDING' || data.type === 'ORDER_WAITING')) {
            fetchOrders();
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fpt_latest_pending_order' || e.key === 'fpt_latest_waiting_order') {
        fetchOrders();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const extractInnerKey = (token: string): string => {
    if (!token || typeof token !== 'string') return '';
    let cur = token.trim();
    const salt = 'ENX_SEC_2026_FLASH_LITE';
    for (let depth = 0; depth < 5; depth++) {
      if (cur.startsWith('AIza') || cur.startsWith('AQ.')) return cur;
      if (!cur.startsWith('ENC_AI_')) break;
      try {
        const b64 = cur.slice(7);
        const hex = atob(b64);
        let out = '';
        for (let i = 0; i < hex.length; i += 2) {
          const c = parseInt(hex.substr(i, 2), 16) ^ salt.charCodeAt((i / 2) % salt.length);
          out += String.fromCharCode(c);
        }
        if (out.startsWith('EXP|')) {
          const parts = out.split('|');
          cur = parts.slice(3).join('|').trim();
        } else {
          cur = out.trim();
        }
      } catch {
        break;
      }
    }
    return cur;
  };

  const isGeminiFormat = (k: string) => {
    if (!k || typeof k !== 'string') return false;
    const clean = k.trim();
    return clean.startsWith('AIza') || clean.startsWith('AQ.') || clean.startsWith('ENC_AI_') || clean.length >= 20;
  };

  // Admin approves order and issues Key (supports orderId or transferCode)
  const handleApproveOrder = async (orderId: string, transferCode?: string) => {
    let keyToUse = masterApiKey.trim();
    if (keyToUse.startsWith('ENC_AI_')) {
      const unwrapped = extractInnerKey(keyToUse);
      if (unwrapped && (unwrapped.startsWith('AIza') || unwrapped.startsWith('AQ.'))) {
        keyToUse = unwrapped;
      }
    }
    // Auto-fallback to valid default key if Admin hasn't configured a key yet
    if (!keyToUse) {
      keyToUse = extractInnerKey(ENCRYPTED_DEFAULT_TOKEN);
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
          apiKey: keyToUse
        })
      });
      const data = await res.json();
      if (data.success) {
        // Broadcast instant approval event to customer modal (0ms response)
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('fpt_studyhub_orders');
            bc.postMessage({
              type: 'ORDER_APPROVED',
              orderId: data.order?.orderId || orderId,
              transferCode: data.order?.transferCode || transferCode,
              licenseKey: data.licenseKey,
              order: data.order
            });
            bc.close();
          }
          localStorage.setItem('fpt_latest_approved_order', JSON.stringify({
            orderId: data.order?.orderId || orderId,
            transferCode: data.order?.transferCode || transferCode,
            licenseKey: data.licenseKey,
            order: data.order,
            t: Date.now()
          }));
          const rawStored = localStorage.getItem('fpt_admin_persisted_orders_v10');
          const currentList: OrderItem[] = rawStored ? JSON.parse(rawStored) : orders;
          const updatedList = currentList.map(o => {
            if (o.orderId === (data.order?.orderId || orderId) || o.transferCode === (data.order?.transferCode || transferCode)) {
              return { ...o, ...(data.order || {}), status: 'approved', licenseKey: data.licenseKey || o.licenseKey };
            }
            return o;
          });
          localStorage.setItem('fpt_admin_persisted_orders_v10', JSON.stringify(updatedList));
        } catch {}

        await fetchOrders();
        alert(`✓ Đã duyệt và cấp Key thành công cho đơn ${orderId || transferCode}! Màn hình khách hàng sẽ tự động nhận Bookmarklet.`);
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
    let code = quickCode.trim().toUpperCase();
    if (!code) return;
    if (/^\d{4}$/.test(code)) {
      code = 'PR' + code;
    }

    setIsQuickApproving(true);
    try {
      await handleApproveOrder('', code);
      setQuickCode('');
    } finally {
      setIsQuickApproving(false);
    }
  };

  // Extend active license key
  const handleExtendOrder = async (orderId: string, addDays: number) => {
    setExtendingOrderId(orderId);
    try {
      const res = await fetch(`/api/v1/orders?t=${Date.now()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          orderId,
          action: 'extend',
          addDays,
          apiKey: masterApiKey.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrders();
      } else {
        alert('Gia hạn không thành công: ' + (data.message || 'Lỗi server'));
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setExtendingOrderId(null);
    }
  };

  // Revoke active license key
  const handleRevokeOrder = async (orderId: string) => {
    if (!confirm(`Bạn có chắc muốn khóa / thu hồi bản quyền của đơn ${orderId} này? Khách hàng sẽ không thể tiếp tục sử dụng.`)) return;
    try {
      const res = await fetch(`/api/v1/orders?t=${Date.now()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          orderId,
          action: 'revoke'
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchOrders();
      }
    } catch (e) {
      console.error('Revoke order error:', e);
    }
  };

  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    setCurrentTime(Date.now());
    const t = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Compute License Monitoring List
  const licenseRows = approvedOrders.map(ord => {
    const info = parseClientLicense(ord.licenseKey, ord.expiresAt, currentTime || undefined);
    return {
      order: ord,
      info
    };
  });

  const activeCount = licenseRows.filter(r => r.info && !r.info.expired && !r.info.isNearExpiry).length;
  const warningCount = licenseRows.filter(r => r.info && r.info.isNearExpiry).length;
  const expiredCount = licenseRows.filter(r => r.info && r.info.expired).length;

  const filteredLicenseRows = licenseRows.filter(r => {
    if (keyFilter === 'warning') return r.info?.isNearExpiry;
    if (keyFilter === 'active') return r.info && !r.info.expired && !r.info.isNearExpiry;
    if (keyFilter === 'expired') return r.info?.expired;
    return true;
  });

  // Manual Key Generator
  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(durationDays, 10);
    let planLabel = '1 Tuần';
    let safePlan = '1 Tuan';
    if (days === 30) { planLabel = '1 Tháng'; safePlan = '1 Thang'; }
    if (days === 120) { planLabel = '1 Kỳ Học (4 Tháng)'; safePlan = '1 Ky Hoc (4 Thang)'; }

    let rawKey = customApiKey.trim() || masterApiKey.trim();
    if (rawKey.startsWith('ENC_AI_')) {
      const unwrapped = extractInnerKey(rawKey);
      if (unwrapped && (unwrapped.startsWith('AIza') || unwrapped.startsWith('AQ.'))) {
        rawKey = unwrapped;
      }
    }
    const expiresAt = Date.now() + days * 24 * 3600 * 1000;
    const payload = `EXP|${expiresAt}|${safePlan}|${rawKey}`;
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
              <Badge variant="emerald" size="sm">v10.2.54 PRO</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Admin: <strong>{BANK_CONFIG.accountName}</strong> • {BANK_CONFIG.bankName}: <strong className="font-mono text-emerald-400">{BANK_CONFIG.accountNo}</strong> • Discord: <a href={BANK_CONFIG.discordContactUrl} target="_blank" className="text-indigo-400 underline">888713971161505832</a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={async () => {
                if (confirm('Bạn có chắc chắn muốn XÓA TRẮNG toàn bộ danh sách đơn hàng để bắt đầu lại từ đầu?')) {
                  try {
                    localStorage.removeItem('fpt_admin_persisted_orders_v10');
                    setOrders([]);
                    await fetch('/api/v1/orders', { method: 'DELETE' });
                    alert('✓ Đã xóa sạch danh sách đơn hàng (trắng tinh)!');
                  } catch(e: any) {
                    alert('Lỗi: ' + e.message);
                  }
                }
              }}
              className="gap-1.5 cursor-pointer text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Trắng Đơn Hàng</span>
            </Button>
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${masterApiKey ? (masterApiKey.startsWith('ENC_AI_') ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30') : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                  {masterApiKey ? (masterApiKey.startsWith('ENC_AI_') ? '✓ Key Bản Quyền (ENC_AI)' : '✓ Đã Lưu Key Master') : '⚡ Cloud AI Server (Mặc Định)'}
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>+ Lấy Key Miễn Phí (Google Studio)</span>
                </a>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Key này được đóng gói và mã hóa trực tiếp vào Key bản quyền khi Admin bấm <strong className="text-emerald-400">[Duyệt & Cấp Key]</strong>. Hỗ trợ mọi định dạng: <code>AIzaSy...</code>, <code>AQ....</code>, hoặc mã hóa <code>ENC_AI_...</code>.
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
              placeholder="Nhập Master Gemini API Key của Admin (AIzaSy..., AQ..., hoặc ENC_AI_...)"
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

        {/* Section 2: LICENSE EXPIRATION & WARNING MONITORING DASHBOARD */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Timer className="w-5 h-5 text-amber-400" />
                <span>Bảng Quản Lý Thời Hạn & Cảnh Báo Key Gần Hết Hạn</span>
                {warningCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 animate-pulse">
                    ⚠ {warningCount} Key Cần Gia Hạn
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Theo dõi thời gian sử dụng thực tế của khách hàng. Khi hết hạn, key trên máy khách sẽ tự hủy hoàn toàn. Admin có thể bấm gia hạn nhanh +7 ngày hoặc +30 ngày.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setKeyFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  keyFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất Cả ({licenseRows.length})
              </button>
              <button
                type="button"
                onClick={() => setKeyFilter('warning')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  keyFilter === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Sắp Hết Hạn ({warningCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setKeyFilter('active')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  keyFilter === 'active'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
              >
                Còn Hạn ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setKeyFilter('expired')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  keyFilter === 'expired'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'text-red-400/80 hover:text-red-300'
                }`}
              >
                Đã Tự Hủy ({expiredCount})
              </button>
            </div>
          </div>

          {filteredLicenseRows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              {keyFilter === 'warning'
                ? 'Không có Key nào sắp hết hạn trong 5 ngày tới. Tất cả khách hàng đều an toàn!'
                : 'Chưa có bản ghi bản quyền nào phù hợp với bộ lọc.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Khách Hàng / Mã Đơn</th>
                    <th className="py-3 px-3">Gói Bản Quyền</th>
                    <th className="py-3 px-3">Thời Điểm Hết Hạn</th>
                    <th className="py-3 px-3">Thời Gian Còn Lại</th>
                    <th className="py-3 px-3">Trạng Thái Key</th>
                    <th className="py-3 px-3 text-right">Gia Hạn Nhanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredLicenseRows.map(({ order: ord, info }) => {
                    const isExp = info?.expired;
                    const isWarn = info?.isNearExpiry;
                    const isOk = info && !info.expired && !info.isNearExpiry;

                    return (
                      <tr key={ord.orderId} className={`hover:bg-slate-800/30 transition-colors ${isWarn ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-3 px-3">
                          <div className="text-white font-bold">{ord.orderId}</div>
                          <div className="text-amber-300 text-[11px] font-bold">Mã CK: {ord.transferCode}</div>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <div className="text-slate-200 font-semibold">{ord.durationLabel || info?.plan || '1 Tuần'}</div>
                          <div className="text-emerald-400 text-[11px] font-mono">{formatVND(ord.amount)}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {info ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{info.expDateStr}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic font-sans">Chưa xác định</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {info ? (
                            <div>
                              {isExp && (
                                <Badge variant="rose" size="sm">
                                  {info.remainingFormatted}
                                </Badge>
                              )}
                              {isWarn && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>{info.remainingFormatted}</span>
                                </span>
                              )}
                              {isOk && (
                                <Badge variant="emerald" size="sm">
                                  {info.remainingFormatted}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">Không có mốc</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {isExp ? (
                            <span className="text-red-400 text-xs font-bold flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                              <span>Đã Tự Hủy</span>
                            </span>
                          ) : isWarn ? (
                            <span className="text-amber-300 text-xs font-bold flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                              <span>Sắp Hết Hạn</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                              <span>Đang Hoạt Động</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={extendingOrderId === ord.orderId}
                              onClick={() => handleExtendOrder(ord.orderId, 7)}
                              className="text-[11px] px-2 py-1 h-auto cursor-pointer hover:border-emerald-500 hover:text-emerald-300"
                              title="Gia hạn thêm 7 ngày"
                            >
                              +7 Ngày
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={extendingOrderId === ord.orderId}
                              onClick={() => handleExtendOrder(ord.orderId, 30)}
                              className="text-[11px] px-2 py-1 h-auto cursor-pointer hover:border-cyan-500 hover:text-cyan-300"
                              title="Gia hạn thêm 30 ngày (1 Tháng)"
                            >
                              +30 Ngày
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={extendingOrderId === ord.orderId}
                              onClick={() => handleExtendOrder(ord.orderId, 120)}
                              className="text-[11px] px-2 py-1 h-auto cursor-pointer hover:border-indigo-500 hover:text-indigo-300"
                              title="Gia hạn thêm 120 ngày (1 Kỳ)"
                            >
                              +1 Kỳ
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleRevokeOrder(ord.orderId)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Thu hồi / Khóa key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: LICENSE KEY GENERATOR (WITH EXPIRATION) */}
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
                  <span>FPT EduNext AI Assistant Pro (v10.2.54)</span>
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
                {customApiKey.trim() && !customApiKey.trim().startsWith('AIza') && !customApiKey.trim().startsWith('AQ.') && !customApiKey.trim().startsWith('ENC_AI_') && customApiKey.trim().length < 20 && (
                  <div className="p-2 rounded bg-amber-950/60 border border-amber-500/50 text-[11px] text-amber-300 flex items-center gap-1.5 mt-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Key Google Gemini chuẩn thường bắt đầu bằng "AIzaSy..." hoặc "AQ....". Hỗ trợ cả mã "ENC_AI_...".</span>
                  </div>
                )}
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
