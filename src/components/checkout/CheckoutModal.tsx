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
  ExternalLink,
  Hourglass
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isWaitingAdmin, setIsWaitingAdmin] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 mins

  // Determine QR image based on exact plan price
  let qrImageSrc = BANK_CONFIG.qr69k || '/qr_69k.jpg';
  if (plan?.price === 30000 || plan?.id?.includes('1w')) {
    qrImageSrc = BANK_CONFIG.qr30k || '/qr_30k.jpg';
  } else if (plan?.price === 69000 || plan?.id?.includes('1m')) {
    qrImageSrc = BANK_CONFIG.qr69k || '/qr_69k.jpg';
  } else if (plan?.price === 220000 || plan?.id?.includes('semester')) {
    qrImageSrc = BANK_CONFIG.qr220k || '/qr_220k.png';
  }

  // Create order when modal opens
  useEffect(() => {
    if (isOpen && service && plan) {
      setTimeLeft(600);
      setIsWaitingAdmin(false);
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

  // Polling for Admin Approval when waiting
  useEffect(() => {
    if (!isOpen || !order || (!isWaitingAdmin && order.status !== 'waiting_approval')) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/orders?orderId=${order.orderId}`);
        const data = await res.json();
        if (data.success && data.order && data.order.status === 'approved' && data.licenseKey) {
          clearInterval(pollInterval);
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 }
          });
          onPaymentSuccess(data.order, data.licenseKey);
        }
      } catch (e) {
        console.error('Polling order status error:', e);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isOpen, order, isWaitingAdmin, onPaymentSuccess]);

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Submit transfer confirmation -> Wait for admin approval
  const handleConfirmPayment = async () => {
    if (!order) return;
    setIsVerifying(true);

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: order.orderId,
          action: 'confirm_transfer'
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsWaitingAdmin(true);
        setOrder(prev => prev ? { ...prev, status: 'waiting_approval' } : null);
      }
    } catch (e) {
      console.error('Submit transfer confirmation error:', e);
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
              src={qrImageSrc}
              alt={`Mã QR Chuyển Khoản VIB - ${BANK_CONFIG.accountName}`}
              className="w-56 h-auto object-contain rounded-xl shadow-sm"
            />
            <div className="mt-2 text-center">
              <div className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Quét Mã QR VIB Napas 247
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
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Liên hệ Admin qua Discord để duyệt đơn & cấp key tức thì:</span>
          </div>
          <a
            href={BANK_CONFIG.discordContactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shrink-0 text-xs shadow-md shadow-indigo-950"
          >
            <span>Nhắn Discord Admin</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Status / Call To Action */}
        {isWaitingAdmin ? (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-300 font-bold text-sm">
              <Hourglass className="w-4 h-4 animate-spin text-amber-400" />
              <span>Đang Chờ Admin Duyệt Đơn & Cấp Key Bản Quyền...</span>
            </div>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Hệ thống đang tự động kiểm tra trạng thái mỗi 3 giây. Sau khi Admin bấm duyệt trên web quản trị, màn hình sẽ tự động chuyển sang trang nhận Key và Bookmarklet!
            </p>
            <div className="pt-2">
              <a
                href={BANK_CONFIG.discordContactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white underline"
              >
                <span>Nhắn Discord Admin mã đơn [{order?.orderId}] để được duyệt ngay trong 30 giây</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:w-auto text-slate-400 hover:text-white border-slate-700"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmPayment}
              disabled={isVerifying}
              className="w-full sm:flex-1 justify-center shadow-lg shadow-emerald-950/60"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  <span>Đang gửi thông tin...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-1 text-emerald-300" />
                  <span>Tôi Đã Chuyển Khoản — Báo Admin Duyệt Ngay</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
