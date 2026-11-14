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
  const defaultToken = 'FPT1.eyJvcmRlcklkIjoiT1JELTg4ODctU0VNRVNURVItVklQIiwiZXhwaXJlc0F0IjoxODA0OTkwODg4NTE0LCJwbGFuIjoiMSBL4buzIEjhu41jICg0IFRow6FuZykiLCJub25jZSI6InNlZWQtdmlwLTIwMjYifQ.eaIyaxIoNHGg5Xv1lGJueKphjp1UHa8kE8cPmQdn3LE';
  const key = licenseKey || defaultToken;
  return `javascript:(function(){window.__ENX_KEY__='${key}';var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/khang224466/NX@main/BUISINESS/v10_2_66_minified.js?t='+Date.now();s.async=true;(document.head||document.documentElement).appendChild(s);})();`;
}
