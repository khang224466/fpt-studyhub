'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap, Key, Sparkles, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-white tracking-tight">FPT Study Hub</span>
              <Badge variant="emerald" size="sm" className="hidden sm:inline-flex">FPT Only</Badge>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">EduNext (v10.2.21) • Khảo Thí • SEB</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a href="#trailer" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
            <span>Video Trailer</span>
          </a>
          <a href="#services" className="hover:text-white transition-colors">Bảng Gói Bản Quyền</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">Cách Dùng 1-Click</a>
          <a href="#comparison" className="hover:text-white transition-colors">Hiệu Quả Vượt Trội</a>
          <a href="#faq" className="hover:text-white transition-colors">Hỏi Đáp</a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link href="/activate">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tra Cứu License</span>
            </Button>
          </Link>
          <a href="#services">
            <Button variant="primary" size="sm" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đăng Ký Ngay</span>
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
