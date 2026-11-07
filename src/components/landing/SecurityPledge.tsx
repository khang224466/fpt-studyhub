'use client';

import React from 'react';
import { ShieldCheck, RefreshCw, Headphones, Lock } from 'lucide-react';

export function SecurityPledge() {
  const pledges = [
    {
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      title: 'Bảo Vệ Quyền Riêng Tư',
      desc: 'Chúng tôi không đọc, lưu trữ hay can thiệp vào các đoạn chat, file thiết kế hay dữ liệu bạn tạo trong quá trình sử dụng dịch vụ.'
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-cyan-400" />,
      title: 'Cam Kết Hoàn Tiền 100%',
      desc: 'Nếu tài khoản gặp sự cố không thể khắc phục trong thời hạn thuê, bạn sẽ được cấp lại tài khoản mới ngay lập tức hoặc hoàn tiền 100%.'
    },
    {
      icon: <Headphones className="w-5 h-5 text-indigo-400" />,
      title: 'Hỗ Trợ Kỹ Thuật 24/7',
      desc: 'Đội ngũ trực Zalo & Telegram luôn sẵn sàng phản hồi trong vòng 3 phút khi bạn cần hướng dẫn cài đặt hoặc giải đáp thắc mắc.'
    }
  ];

  return (
    <section className="py-16 border-t border-slate-800/80 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pledges.map((p, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0">
                {p.icon}
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">{p.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
