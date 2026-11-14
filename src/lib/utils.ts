import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function generateVietQRUrl(bankId: string, accountNo: string, amount: number, memo: string, accountName: string): string {
  const encodedMemo = encodeURIComponent(memo);
  const encodedName = encodeURIComponent(accountName);
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${encodedName}`;
}

export function generateBookmarkletCode(licenseKey?: string, host?: string): string {
  const origin = host && host.startsWith('http') 
    ? host 
    : (typeof window !== 'undefined' ? window.location.origin : 'https://fpt-studyhub.vercel.app');
  const keyParam = licenseKey ? encodeURIComponent(licenseKey) : '';
  return `javascript:(function(){var s=document.createElement('script');s.src='${origin}/inject.js?key=${keyParam}&t='+Date.now();s.async=true;(document.head||document.documentElement).appendChild(s);})();`;
}
