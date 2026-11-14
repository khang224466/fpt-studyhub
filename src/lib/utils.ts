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
  const defaultToken = 'ENC_AI_MDAxNjA4MjM2MjdkNzM2YjA1MDcwMzA3NmM3NDc1NzY2MzM0NmU2YzAyMmQ2NTBkMjEzYjdmN2I3MTYzMGI1YTUxNWM1MTc2M2EwZDEwN2QwOTNkNzQxYjFhNzMwYzdlMmIyNzJhMjI3YjFhNDU1ODQ0NzUxNTJmM2YyNjYxMGYzMTBkMWYxMDc0MDI3YzA5MGYxZjcwMzUwNzYxNGE1NjRmM2IzYzM4Mjk3ZTcxM2EzYzJl';
  const key = licenseKey || defaultToken;
  return `javascript:(function(){window.__ENX_KEY__='${key}';var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/khang224466/NX@main/BUISINESS/v10_2_62_minified.js?t='+Date.now();s.async=true;(document.head||document.documentElement).appendChild(s);})();`;
}
