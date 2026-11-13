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

export { EDUNEXT_SOURCE as RAW_FN_STRING } from './edunextBundle';
import { EDUNEXT_SOURCE } from './edunextBundle';
export function generateBookmarkletCode(licenseKey?: string, host?: string): string {
  if (!licenseKey?.startsWith('FPT1.')) return '';
  const origin = host || (typeof window !== 'undefined' ? window.location.origin : 'https://fpt-studyhub.vercel.app');
  return 'javascript:(' + EDUNEXT_SOURCE + ')(' + JSON.stringify(licenseKey) + ',' + JSON.stringify(origin) + ');';
}
