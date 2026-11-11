export type ServiceCategory = 'all' | 'edunext' | 'khaothi' | 'seb';

export type DurationTier = '2h' | '1w' | '1m' | 'semester' | 'lifetime';

export interface PricingPlan {
  id: string;
  duration: DurationTier;
  durationLabel: string;
  price: number; // VND
  originalPrice: number;
  isPopular?: boolean;
  badge?: string;
  renewalNote?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  category: 'edunext' | 'khaothi' | 'seb';
  categoryLabel: string;
  tagline: string;
  iconName: string;
  targetDomain: string;
  authMethod: 'localStorage' | 'sessionStorage' | 'cookie' | 'extensionBridge';
  badge?: string;
  isComingSoon?: boolean;
  features: string[];
  plans: PricingPlan[];
  activeUsersCount: number;
  rating: number;
  accentColor: string;
}

export interface OrderItem {
  orderId: string;
  serviceId: string;
  serviceName: string;
  planId: string;
  durationLabel: string;
  amount: number;
  customerEmail?: string;
  customerPhone?: string;
  transferCode: string;
  status: 'pending' | 'waiting_approval' | 'approved' | 'paid' | 'cancelled';
  createdAt: number;
  paidAt?: number;
  licenseKey?: string;
  expiresAt?: number;
  durationDays?: number;
}

export interface LicenseRecord {
  key: string;
  serviceId: string;
  serviceName: string;
  targetDomain: string;
  durationHours: number;
  activatedAt?: number;
  expiresAt?: number;
  status: 'unused' | 'active' | 'expired' | 'revoked';
  deviceFingerprint?: string;
  ipAddress?: string;
}

export interface AccountSessionPool {
  id: string;
  serviceId: string;
  accountEmail: string;
  tier: string;
  maxConcurrentUsers: number;
  currentActiveUsers: number;
  status: 'healthy' | 'warning' | 'expired';
  lastHealthCheck: number;
  authPayload: Record<string, any>;
}
