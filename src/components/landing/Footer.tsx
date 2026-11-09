import React from 'react';
import Link from 'next/link';
import { ShieldCheck, GraduationCap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 py-12 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1 */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <GraduationCap className="w-4 h-4 fill-current" />
              </div>
              <span className="font-bold text-white text-base">FPT Study Hub</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hệ sinh thái công cụ hỗ trợ sinh viên FPT giải bài tập EduNext (v10.2.4), ôn luyện Khảo Thí Online và chuẩn hóa môi trường Safe Exam Browser (SEB).
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <div className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Hệ Thống Trọng Tâm</div>
            <ul className="space-y-2 text-xs">
              <li><a href="#services" className="hover:text-white transition-colors">FPT EduNext Assistant Pro (v10.2.4)</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">FPT Khảo Thí Online — Đề Thi Thử</a></li>
              <li><a href="#services" className="hover:text-white transition-colors">Safe Exam Browser (SEB) Toolkit</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <div className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Hỗ Trợ & Tra Cứu</div>
            <ul className="space-y-2 text-xs">
              <li><Link href="/activate" className="hover:text-white transition-colors">Tra Cứu License Sinh Viên</Link></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">Hướng Dẫn Cài Đặt Bookmarklet</a></li>
              <li><a href="#comparison" className="hover:text-white transition-colors">Cam Kết Hoàn Tiền 100%</a></li>
              <li><Link href="/admin" className="hover:text-white transition-colors text-slate-600">Trang Quản Trị Hệ Thống</Link></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <div className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Cam Kết Bảo Mật</div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Zero-Password Safe</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Hệ thống chỉ nạp session tạm thời qua Bookmarklet. Không bao giờ yêu cầu mật khẩu email hay can thiệp hệ thống phòng thi của nhà trường.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © 2026 FPT Study Hub. Thiết kế độc quyền cho cộng đồng sinh viên FPT University & FSchool.
          </div>
          <div className="flex items-center gap-6">
            <span className="text-slate-400">Phiên bản: <strong className="text-emerald-400 font-mono">v10.2.4 PRO</strong></span>
            <span>Khảo Thí & SEB: <strong className="text-amber-400">Sắp Ra Mắt</strong></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
