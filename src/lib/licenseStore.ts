// Shared memory store for licenses, orders and trial tracking

export interface LicenseRecord {
  licenseKey: string;
  serviceId: string;
  planId: string;
  createdAt: number;
  expiresAt: number;
  isTrial: boolean;
  activeRequestsCount: number;
}

// Global persistence in Next.js dev server hot-reload
const globalForStore = globalThis as unknown as {
  _studyHubLicenses?: Map<string, LicenseRecord>;
};

export const licensesStore: Map<string, LicenseRecord> =
  globalForStore._studyHubLicenses || new Map<string, LicenseRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalForStore._studyHubLicenses = licensesStore;
}

// Pre-seed demo VIP key
if (!licensesStore.has('DEMO-EDUNEXT-2026')) {
  licensesStore.set('DEMO-EDUNEXT-2026', {
    licenseKey: 'DEMO-EDUNEXT-2026',
    serviceId: 'edunext-assistant',
    planId: 'edunext-semester',
    createdAt: Date.now(),
    expiresAt: Date.now() + 120 * 24 * 3600 * 1000,
    isTrial: false,
    activeRequestsCount: 0
  });
}

/**
 * Register or fetch a trial license (2 Hours active)
 */
export function registerTrialLicense(key?: string): LicenseRecord {
  const licenseKey = key || `TRIAL-EDUNEXT-2H-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const existing = licensesStore.get(licenseKey);
  if (existing) return existing;

  const now = Date.now();
  const record: LicenseRecord = {
    licenseKey,
    serviceId: 'edunext-assistant',
    planId: 'edunext-2h',
    createdAt: now,
    expiresAt: now + 2 * 3600 * 1000, // Exactly 2 Hours
    isTrial: true,
    activeRequestsCount: 0
  };

  licensesStore.set(licenseKey, record);
  return record;
}

/**
 * Verify license status and calculate remaining time
 */
export function verifyLicense(licenseKey: string): {
  valid: boolean;
  reason?: string;
  record?: LicenseRecord;
  remainingMs: number;
  formattedRemaining: string;
} {
  if (!licenseKey) {
    return {
      valid: false,
      reason: 'Thiếu License Key xác thực',
      remainingMs: 0,
      formattedRemaining: '0 phút'
    };
  }

  let record = licensesStore.get(licenseKey);

  // Auto-register any key supplied by user or generated for customers
  if (!record && licenseKey.trim().length >= 3) {
    const isTrial = licenseKey.toUpperCase().includes('TRIAL');
    const now = Date.now();
    record = {
      licenseKey,
      serviceId: 'edunext-assistant',
      planId: isTrial ? 'edunext-2h' : 'edunext-semester',
      createdAt: now,
      expiresAt: isTrial ? (now + 2 * 3600 * 1000) : (now + 180 * 24 * 3600 * 1000),
      isTrial,
      activeRequestsCount: 0
    };
    licensesStore.set(licenseKey, record);
  }

  if (!record) {
    return {
      valid: false,
      reason: 'Mã License Key không tồn tại trên hệ thống hoặc đã bị hủy.',
      remainingMs: 0,
      formattedRemaining: '0 phút'
    };
  }

  const now = Date.now();
  const remainingMs = Math.max(0, record.expiresAt - now);

  if (remainingMs <= 0) {
    return {
      valid: false,
      reason: record.isTrial 
        ? 'Thời gian trải nghiệm 2 tiếng (0₫) đã hết hạn. Hãy đăng ký gói 1 tuần (30k) hoặc 1 kỳ (220k) để tiếp tục giải bài tập không giới hạn!'
        : 'Gói bản quyền của bạn đã hết hạn. Vui lòng gia hạn thêm thời gian sử dụng.',
      record,
      remainingMs: 0,
      formattedRemaining: '0 phút'
    };
  }

  const hours = Math.floor(remainingMs / (3600 * 1000));
  const minutes = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
  const days = Math.floor(hours / 24);

  let formattedRemaining = '';
  if (days > 0) {
    formattedRemaining = `${days} ngày ${hours % 24} giờ`;
  } else if (hours > 0) {
    formattedRemaining = `${hours} giờ ${minutes} phút`;
  } else {
    formattedRemaining = `${minutes} phút`;
  }

  return {
    valid: true,
    record,
    remainingMs,
    formattedRemaining
  };
}
