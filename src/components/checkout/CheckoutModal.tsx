'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Copy, Check, QrCode, Clock, ShieldCheck, ArrowRight, AlertCircle, RefreshCw, Gift } from 'lucide-react';
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
  const [qrUrl, setQrUrl] = useState<string>('');
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
          setQrUrl(data.qrUrl);
        }
      })
      .catch(err => console.error('Order creation error:', err));
    }
  }, [isOpen, service, plan]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0 || plan?.price === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft, plan]);

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Verify payment action / Claim Free Trial
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

  const isFreeTrial = plan.price === 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isFreeTrial ? "Nhận Mã Trải Nghiệm Miễn Phí" : "Thanh Toán Đăng Ký Gói"}
      description={`Gói ${service.name} — Thời hạn ${plan.durationLabel}`}
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Free Trial Banner OR Timer Bar */}
        {isFreeTrial ? (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              <span>Gói trải nghiệm 2 tiếng hoàn toàn <strong>Miễn Phí (0₫)</strong> dành cho sinh viên FPT!</span>
            </div>
            <Badge variant="emerald" size="sm">0₫ Dùng Thử</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Mã QR thanh toán hết hạn sau:</span>
            </div>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        )}

        {isFreeTrial ? (
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
              <Gift className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Bạn Không Cần Chuyển Khoản</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Hệ thống sẽ cấp ngay một mã License Key dùng thử 2 tiếng kèm nút Bookmarklet để bạn trải nghiệm tính năng tự động giải bài tập và vượt qua hộp Làm Rõ Ý Định ngay lập tức.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* QR Column */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white text-slate-900 border border-slate-800 shadow-inner">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="VietQR Chuyển Khoản"
                  className="w-56 h-auto object-contain rounded-lg shadow-sm"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-lg">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              )}
              <div className="mt-3 text-center">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Quét Bằng Mọi App Ngân Hàng</div>
                <div className="text-[11px] text-slate-500">Momo, ZaloPay, Vietcombank, MB, Techcombank...</div>
              </div>
            </div>

            {/* Transfer Info Details */}
            <div className="space-y-3 text-xs">
              {/* Bank Name */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-400">Ngân hàng:</div>
                  <div className="font-bold text-white text-sm">{BANK_CONFIG.bankName}</div>
                </div>
              </div>

              {/* Account Number */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-400">Số tài khoản:</div>
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
                <div className="text-slate-400">Chủ tài khoản:</div>
                <div className="font-bold text-white text-sm">{BANK_CONFIG.accountName}</div>
              </div>

              {/* Amount */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-400">Số tiền thanh toán:</div>
                  <div className="font-bold text-emerald-400 text-lg">{formatVND(plan.price)}</div>
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
                  <div className="text-emerald-300 font-semibold">Nội dung chuyển khoản (Bắt buộc):</div>
                  <div className="font-mono font-black text-amber-300 text-base">
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
        )}

        {/* Notice */}
        {!isFreeTrial && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300/90 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Vui lòng điền <strong>chính xác nội dung chuyển khoản</strong> để hệ thống tự động kích hoạt License Key trong 5 giây mà không cần chờ duyệt thủ công.
            </span>
          </div>
        )}

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
            <span>{isFreeTrial ? 'Kích Hoạt Trải Nghiệm 2 Tiếng Ngay' : 'Tôi Đã Chuyển Khoản Thành Công'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
