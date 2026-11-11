import React from 'react';
import { QrCode, MousePointerClick, Zap, Shield, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function HowItWorks() {
  const steps = [
    {
      step: '01',
      icon: <QrCode className="w-6 h-6 text-emerald-400" />,
      title: 'Chọn Gói & Quét Mã VietQR',
      desc: 'Chọn dịch vụ và thời gian bạn cần (3h, 1 ngày, 1 tháng...). Quét mã VietQR với nội dung nạp tự động, hệ thống cấp mã License tức thì trong 5 giây.'
    },
    {
      step: '02',
      icon: <MousePointerClick className="w-6 h-6 text-cyan-400" />,
      title: 'Kéo Thả Bookmarklet 1 Lần',
      desc: 'Kéo nút bấm chứa đoạn mã kích hoạt thả vào thanh dấu trang (Bookmarks Bar) trên trình duyệt Chrome, Edge, Cốc Cốc, Brave hoặc Safari của bạn.'
    },
    {
      step: '03',
      icon: <Zap className="w-6 h-6 text-indigo-400" />,
      title: 'Mở Trang Web & Bấm Kích Hoạt',
      desc: 'Truy cập trang web dịch vụ (chatgpt.com, canva.com...), bấm vào Bookmark vừa tạo. Màn hình hiện HUD công nghệ, tự nạp session và reload vào thẳng bản quyền.'
    }
  ];

  return (
    <section id="how-it-works" className="py-20 border-t border-slate-800/80 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="indigo" size="md" className="mb-3">
            Quy Trình 3 Bước Đơn Giản
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Cách Thuê & Sử Dụng Bằng Bookmarklet
          </h2>
          <p className="mt-3 text-slate-400 text-base sm:text-lg">
            Không cần tài khoản & mật khẩu gốc. Không cần cài tiện ích mở rộng. Không lo máy bị xung đột hay chặn quyền admin.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((st) => (
            <div
              key={st.step}
              className="relative rounded-2xl bg-slate-900/80 border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all duration-200 group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    {st.icon}
                  </div>
                  <span className="text-3xl font-black text-slate-700 font-mono group-hover:text-emerald-500/40 transition-colors">
                    {st.step}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{st.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{st.desc}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs font-medium text-slate-500">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bảo mật phiên làm việc độc lập</span>
              </div>
            </div>
          ))}
        </div>

        {/* Technology Highlight Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Cơ Chế Dynamic Loader Thông Minh</span>
            </div>
            <div className="text-lg font-bold text-white">Bookmarklet an toàn tuyệt đối — Không chứa mã độc</div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Đoạn mã dấu trang chỉ là 1 trình nạp ngắn (`loader script`). Mọi thao tác xác thực License Key và bơm phiên làm việc đều được mã hóa SSL/TLS trực tiếp với API máy chủ.
            </p>
          </div>
          <div className="shrink-0 font-mono text-xs bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300">
            {'javascript:(function(){/* loader */})();'}
          </div>
        </div>
      </div>
    </section>
  );
}
