'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatVND, generateBookmarkletCode } from '@/lib/utils';
import type { OrderItem } from '@/types/rental';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [code, setCode] = useState('');
  const [days, setDays] = useState(7);
  const [generated, setGenerated] = useState('');

  const request = useCallback(async (url: string, init?: RequestInit, credential = token) => {
    const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` } });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Yêu cầu không thành công.');
    return data;
  }, [token]);
  const refresh = useCallback(async () => {
    const data = await request('/api/v1/orders');
    setOrders(data.orders);
  }, [request]);

  useEffect(() => {
    // Remove credentials retained by older versions. Admin session stays in memory only.
    localStorage.removeItem('fpt_admin_master_gemini_key');
    localStorage.removeItem('enx_bridge_gemini_key');
    if (!token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { if (document.visibilityState !== 'hidden') await refresh(); }
      catch (error) { if (!stopped) setMessage(error instanceof Error ? error.message : 'Lỗi kết nối'); }
      if (!stopped) timer = setTimeout(poll, 4000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [token, refresh]);

  const act = async (action: string, orderId?: string, transferCode?: string) => {
    if (action === 'revoke' && !confirm('Thu hồi quyền sử dụng của đơn này?')) return;
    setBusy(orderId || 'quick'); setMessage('');
    try {
      await request('/api/v1/orders', { method: 'PUT', body: JSON.stringify({ action, orderId, transferCode, addDays: days }) });
      await refresh(); setMessage('Đã cập nhật đơn hàng.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Lỗi kết nối'); }
    finally { setBusy(''); }
  };
  if (!token) return (
    <main className="min-h-screen grid place-items-center bg-slate-950 p-6">
      <form className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 p-8" onSubmit={async event => {
        event.preventDefault(); setBusy('login'); setMessage('');
        try {
          const cleanPass = password.trim();
          const data = await request('/api/v1/orders', undefined, cleanPass);
          setOrders(data.orders);
          setToken(cleanPass);
          setPassword('');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại'); }
        finally { setBusy(''); }
      }}>
        <h1 className="text-2xl font-bold">Quản trị FPT Study Hub</h1>
        <div>
          <label className="block mb-1 text-sm text-slate-300" htmlFor="admin-token">Mã truy cập quản trị</label>
          <p className="text-xs text-slate-400 mb-2">Mật mã mặc định: <span className="font-mono text-emerald-400 font-bold">admin123</span> (hoặc token Vercel nếu có cài)</p>
          <input id="admin-token" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập admin123" className="w-full rounded-lg bg-slate-900 p-3 border border-slate-700 text-white" />
        </div>
        <Button disabled={Boolean(busy)} type="submit">Đăng nhập</Button>
        <p role="alert" className="text-amber-300">{message}</p>
        <Link href="/" className="block text-emerald-400">Về trang chủ</Link>
      </form>
    </main>
  );
  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8"><div className="max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center gap-4"><h1 className="text-2xl font-bold">Quản lý đơn & license · v10.2.50</h1><Button onClick={() => { setToken(''); setOrders([]); setGenerated(''); }}>Đăng xuất</Button></header>
      <p className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">API key chỉ được cấu hình trên máy chủ. License khách hàng không chứa API key.</p>
      <p role="status" className="text-amber-300">{message}</p>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-900 p-5">Đơn chờ duyệt: <strong>{orders.filter(o => o.status === 'waiting_approval').length}</strong></div>
        <div className="rounded-xl bg-slate-900 p-5">Đã duyệt: <strong>{orders.filter(o => o.status === 'approved').length}</strong></div>
        <div className="rounded-xl bg-slate-900 p-5">Doanh thu: <strong>{formatVND(orders.filter(o => ['approved', 'paid'].includes(o.status)).reduce((s,o) => s + o.amount, 0))}</strong></div>
      </div>
      <form className="flex flex-wrap gap-3 items-center" onSubmit={e => { e.preventDefault(); void act('approve', undefined, code.trim().toUpperCase()); }}>
        <label htmlFor="transfer-code">Duyệt theo mã chuyển khoản</label><input id="transfer-code" required value={code} onChange={e => setCode(e.target.value)} className="bg-slate-900 rounded-lg p-2 border border-slate-700" /><Button disabled={Boolean(busy)}>Duyệt đơn</Button>
      </form>
      <label className="flex gap-3 items-center">Số ngày gia hạn / cấp thủ công <input type="number" min="1" max="365" value={days} onChange={e => setDays(Number(e.target.value))} className="w-24 bg-slate-900 rounded-lg p-2" /></label>
      <Button disabled={Boolean(busy)} onClick={async () => {
        setBusy('generate'); setMessage('');
        try { const data = await request('/api/v1/admin/licenses', { method: 'POST', body: JSON.stringify({ days }) }); setGenerated(data.licenseKey); await refresh(); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể cấp license'); }
        finally { setBusy(''); }
      }}>Cấp license thủ công</Button>
      {generated && <div className="space-y-2 rounded-xl p-4 bg-slate-900"><p>License vừa cấp</p><code className="break-all text-xs">{generated}</code><Button onClick={() => navigator.clipboard.writeText(generated)}>Sao chép license</Button></div>}
      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-sm text-left"><thead className="bg-slate-900"><tr>{['Mã đơn / CK', 'Gói / Số tiền', 'Trạng thái', 'Hết hạn', 'Thao tác'].map(t => <th key={t} className="p-4">{t}</th>)}</tr></thead><tbody>
        {orders.map(order => <tr key={order.orderId} className="border-t border-slate-800">
          <td className="p-4"><div className="font-mono text-xs break-all">{order.orderId}</div><strong>{order.transferCode}</strong></td>
          <td className="p-4">{order.durationLabel}<br />{formatVND(order.amount)}</td><td className="p-4">{order.status}</td><td className="p-4">{order.expiresAt ? new Date(order.expiresAt).toLocaleString('vi-VN') : '—'}</td>
          <td className="p-4"><div className="flex flex-wrap gap-2">
            {['pending', 'waiting_approval'].includes(order.status) && <Button disabled={Boolean(busy)} onClick={() => act('approve', order.orderId)}>Duyệt & cấp</Button>}
            {['approved', 'paid'].includes(order.status) && <><Button disabled={Boolean(busy)} onClick={() => act('extend', order.orderId)}>Gia hạn</Button><Button disabled={Boolean(busy)} variant="danger" onClick={() => act('revoke', order.orderId)}>Thu hồi</Button><Button onClick={() => navigator.clipboard.writeText(order.licenseKey || '')}>Copy license</Button><Button onClick={() => navigator.clipboard.writeText(generateBookmarkletCode(order.licenseKey, window.location.origin))}>Copy bookmarklet</Button></>}
          </div></td>
        </tr>)}
      </tbody></table></div>
    </div></main>
  );
}
