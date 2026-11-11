import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FPT Study Hub — Bộ 3 Công Cụ: EduNext • Khảo Thí Online • Safe Exam Browser (SEB)',
  description: 'Hệ sinh thái công cụ dành riêng cho sinh viên FPT: Giải bài tập EduNext Assistant v10.2.32 (chống 429, khớp mẫu Trả lời), ôn luyện Khảo Thí Online, chuẩn hóa cấu hình Safe Exam Browser (SEB).',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}
