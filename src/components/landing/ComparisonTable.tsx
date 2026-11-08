'use client';

import React from 'react';
import { Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function ComparisonTable() {
  const rows = [
    {
      feature: 'Tự động giải bài tập EduNext & quét đề',
      fptHub: 'Quét màn hình 5s, tự điền đáp án chuẩn',
      manual: 'Phải chụp màn hình, tự copy gõ lại mất thời gian',
      tools: 'Tool cũ bị kẹt, không nhận diện được ảnh mới'
    },
    {
      feature: 'Khắc phục lỗi 429 Too Many Requests',
      fptHub: 'Cơ chế Dual Interceptor (Fetch & XHR) chặn triệt để',
      manual: 'Không bị (nhưng làm thủ công rất chậm)',
      tools: 'Bị spam click liên tục làm sập chat và khóa tạm thời'
    },
    {
      feature: 'Khớp mẫu câu trả lời theo yêu cầu đề',
      fptHub: 'Tự khớp chuẩn "Trả lời: [đáp án]" giúp AI chấm đỗ ngay',
      manual: 'Phải tự đọc kĩ đề bài và gõ đúng cú pháp',
      tools: 'Tự ý xóa chữ "Trả lời:", bị bot AI từ chối và bắt làm lại'
    },
    {
      feature: 'Vượt qua hộp "Làm Rõ Ý Định" trên EduNext',
      fptHub: 'Tự chọn 1 mục và bấm Xác nhận lựa chọn tự động',
      manual: 'Phải canh màn hình để click tay',
      tools: 'Bị kẹt không nộp tiếp được bài'
    },
    {
      feature: 'Hỗ trợ ngân hàng đề Khảo Thí Online & SEB',
      fptHub: 'Đầy đủ kho đề thi thử và tối ưu file cấu hình SEB',
      manual: 'Không có kho đề tổng hợp',
      tools: 'Không hỗ trợ'
    },
    {
      feature: 'Cài đặt & An toàn thiết bị',
      fptHub: 'Kéo thả 1 Bookmarklet 0s, không cần quyền Admin',
      manual: 'Không cần',
      tools: 'Bắt cài Extension hoặc file exe lạ nguy cơ mã độc'
    }
  ];

  return (
    <section id="comparison" className="py-20 border-t border-slate-800/80 bg-slate-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="cyan" size="md" className="mb-3">
            Bảng So Sánh Hiệu Quả
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Vì Sao Sinh Viên FPT Chọn FPT Study Hub?
          </h2>
          <p className="mt-3 text-slate-400 text-base sm:text-lg">
            Khắc phục toàn bộ nhược điểm của việc làm bài thủ công hoặc các script cũ dễ dính lỗi rate limit.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-sm font-semibold">
                <th className="p-4 sm:p-5 text-slate-400 w-1/4">Tính Năng / Trải Nghiệm</th>
                <th className="p-4 sm:p-5 text-emerald-400 bg-emerald-950/30 border-x border-emerald-500/20 w-1/3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>FPT Study Hub (v10.1.5)</span>
                  </div>
                  <span className="text-[11px] text-emerald-400/80 font-normal">Hệ thống tối ưu chuyên biệt</span>
                </th>
                <th className="p-4 sm:p-5 text-slate-300 w-1/5">Tự Làm Thủ Công</th>
                <th className="p-4 sm:p-5 text-slate-300 w-1/5">Script Cũ / Tool Trôi Nổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 sm:p-5 font-medium text-slate-300">{row.feature}</td>
                  <td className="p-4 sm:p-5 font-semibold text-emerald-300 bg-emerald-950/20 border-x border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{row.fptHub}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-slate-400">
                    <div className="flex items-center gap-2">
                      <X className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{row.manual}</span>
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-slate-400">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{row.tools}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
