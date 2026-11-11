'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Copy, 
  Check, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw, 
  MessageSquare, 
  ExternalLink 
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ServiceItem, PricingPlan, OrderItem } from '@/types/rental';
import { formatVND } from '@/lib/utils';
import { BANK_CONFIG } from '@/data/servicesCatalog';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceItem | null;
  plan: PricingPlan | null;
  onPaymentSuccess: (order: OrderItem, licenseKey: string) => void;
}

export function CheckoutModal({
  isOpen,
  onClose,
  service,
  plan,
  onPaymentSuccess
}: CheckoutModalProps) {
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('/qr_payment.jpg');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 mins

  // Create order when modal opens
  useEffect(() => {
    if (isOpen && service && plan) {
      setTimeLeft(600);
      fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          planId: plan.id
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setOrder(data.order);
        }
      })
      .catch(err => console.error('Order creation error:', err));
    }
  }, [isOpen, service, plan]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Verify payment action
  const handleConfirmPayment = async () => {
    if (!order) return;
    setIsVerifying(true);

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderId })
      });
      const data = await res.json();
      if (data.success) {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
        onPaymentSuccess(data.order, data.licenseKey);
      }
    } catch (e) {
      console.error('Verify payment error:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!service || !plan) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thanh Toán Đăng Ký Gói Bản Quyền"
      description={`Gói ${service.name} — Thời hạn ${plan.durationLabel}`}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Timer Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Mã QR thanh toán có hiệu lực trong:</span>
          </div>
          <span className="font-mono font-bold text-amber-400 text-sm">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        {/* QR & Bank Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* QR Column */}
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white text-slate-900 border border-slate-800 shadow-xl">
            <img
              src="/qr_payment.jpg"
              alt="Mã QR Chuyển Khoản MBBank - DIEP DAI PHU"
              className="w-56 h-auto object-contain rounded-xl shadow-sm"
            />
            <div className="mt-2 text-center">
              <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Quét Mã QR MBBank Napas 247
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Mọi ứng dụng ngân hàng & ví điện tử đều quét được
              </div>
            </div>
          </div>

          {/* Transfer Info Details */}
          <div className="space-y-2.5 text-xs">
            {/* Bank Name */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Ngân hàng:</div>
              <div className="font-bold text-white text-sm">{BANK_CONFIG.bankName}</div>
            </div>

            {/* Account Number */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-[11px]">Số tài khoản:</div>
                <div className="font-mono font-bold text-emerald-400 text-base">{BANK_CONFIG.accountNo}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(BANK_CONFIG.accountNo, 'stk')}
              >
                {copiedField === 'stk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'stk' ? 'Đã sao chép' : 'Sao chép'}</span>
              </Button>
            </div>

            {/* Account Owner */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Chủ tài khoản:</div>
              <div className="font-bold text-white text-sm tracking-wide">{BANK_CONFIG.accountName}</div>
            </div>

            {/* Amount */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-slate-400 text-[11px]">Số tiền thanh toán:</div>
                <div className="font-bold text-emerald-400 text-base">{formatVND(plan.price)}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(plan.price.toString(), 'amount')}
              >
                {copiedField === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Sao chép</span>
              </Button>
            </div>

            {/* Memo / Transfer Code */}
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
              <div>
                <div className="text-emerald-300 font-semibold text-[11px]">Nội dung CK (Bắt buộc):</div>
                <div className="font-mono font-black text-amber-300 text-sm">
                  {order?.transferCode || 'PR8888'}
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleCopy(order?.transferCode || '', 'memo')}
              >
                {copiedField === 'memo' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Sao chép mã</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Discord Admin Contact Banner */}
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white">Liên hệ Discord Admin nhận Key & Hỗ trợ:</div>
              <div className="text-[11px] text-indigo-300">
                Sau khi chuyển khoản, nhắn tin trực tiếp để nhận License Key kích hoạt ngay.
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

        {/* Notice */}
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300/90 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Vui lòng điền <strong>chính xác nội dung chuyển khoản</strong> để Admin kích hoạt mã bản quyền nhanh nhất.
          </span>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirmPayment}
            isLoading={isVerifying}
            className="gap-2"
          >
            <span>Tôi Đã Chuyển Khoản & Muốn Nhận Key</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
