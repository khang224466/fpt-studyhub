'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'EduNext Assistant v10.2.60 PRO bảo vệ API Key và xử lý lỗi 429 như thế nào?',
      a: 'Bản nâng cấp v10.2.60 PRO tích hợp Cloud AI Proxy mã hóa toàn bộ API Key trên máy chủ bảo mật 100%, sinh viên dùng thử gói 2 giờ hoàn toàn không cần tự đăng ký key Groq hay Gemini. Đồng thời hệ thống duy trì bộ đánh chặn kép Dual Interceptor hoãn 25s chống bão 429, khóa nút nộp đơn nhất khi aria-pressed="true", và tự động chọn hộp thoại Làm Rõ Ý Định.'
    },
    {
      q: 'Tại sao trước đây bot AI EduNext cứ bắt tôi giải lại cùng một câu hỏi?',
      a: 'Vì một số câu hỏi EduNext yêu cầu học sinh điền theo mẫu nghiêm ngặt, ví dụ: "Trả lời: [đáp án của bạn]". Các phiên bản cũ tự ý xóa chữ "Trả lời:", khiến hệ thống không nhận diện được cú pháp và bắt làm lại. Bản v10.2.60 PRO đã khắc phục hoàn toàn bằng cách tự động khớp mẫu chuẩn.'
    },
    {
      q: 'Cổng Khảo Thí Online hỗ trợ những môn học nào?',
      a: 'Khảo Thí Online cung cấp ngân hàng câu hỏi trắc nghiệm, đề thi thử và đáp án chi tiết cho các môn đại cương (Toán, Hóa, Lý), các môn IT chuyên ngành và tiếng Anh, giúp sinh viên làm quen với áp lực thời gian và dạng bài thi thực tế.'
    },
    {
      q: 'Safe Exam Browser (SEB) Toolkit hỗ trợ xử lý sự cố gì?',
      a: 'Bộ công cụ giúp sinh viên chuẩn hóa cấu hình file .seb tương thích cho từng môn thi, kiểm tra và tắt các tiến trình nền xung đột tránh bị văng khỏi phòng thi, và cung cấp giải pháp khắc phục khi gặp sự cố rớt mạng trong lúc làm bài.'
    },
    {
      q: 'Cài đặt Bookmarklet có cần quyền Admin máy tính không?',
      a: 'Hoàn toàn không cần! Bạn chỉ việc dùng chuột kéo nút Bookmarklet thả lên thanh dấu trang (Bookmarks Bar) của Chrome hoặc Edge là sử dụng được ngay trên mọi máy tính (kể cả máy ở thư viện hay máy phòng Lab trường).'
    }
  ];

  return (
    <section id="faq" className="py-20 border-t border-slate-800/80 bg-slate-950/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Badge variant="amber" size="md" className="mb-3">
            Giải Đáp Thắc Mắc
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Câu Hỏi Thường Gặp Của Sinh Viên FPT
          </h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            Mọi điều bạn cần biết về EduNext Assistant v10.2.60 PRO, Khảo Thí Online và SEB Toolkit.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border transition-all duration-200 overflow-hidden',
                  isOpen
                    ? 'bg-slate-900/90 border-slate-700 shadow-lg shadow-black/40'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700/80'
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="font-semibold text-white text-sm sm:text-base">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200',
                      isOpen && 'transform rotate-180 text-emerald-400'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-slate-400 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 mt-1">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
