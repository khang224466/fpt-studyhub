'use client';

import React, { useState } from 'react';
import { 
  GraduationCap, 
  FileCheck, 
  ShieldAlert, 
  Check, 
  Star, 
  Users, 
  Zap,
  ArrowRight,
  Clock,
  Sparkles
} from 'lucide-react';
import { SERVICES_CATALOG } from '@/data/servicesCatalog';
import { ServiceItem, PricingPlan, ServiceCategory } from '@/types/rental';
import { formatVND, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface ServiceCatalogProps {
  onSelectPlan: (service: ServiceItem, plan: PricingPlan) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  GraduationCap: <GraduationCap className="w-6 h-6 text-emerald-400" />,
  FileCheck: <FileCheck className="w-6 h-6 text-blue-400" />,
  ShieldAlert: <ShieldAlert className="w-6 h-6 text-amber-400" />
};

export function ServiceCatalog({ onSelectPlan }: ServiceCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('all');
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    SERVICES_CATALOG.forEach(s => {
      if (s.plans && s.plans.length > 0) {
        const popular = s.plans.find(p => p.isPopular) || s.plans[0];
        initial[s.id] = popular.id;
      }
    });
    return initial;
  });

  const filteredServices = selectedCategory === 'all'
    ? SERVICES_CATALOG
    : SERVICES_CATALOG.filter(s => s.category === selectedCategory);

  const categories = [
    { id: 'all', label: 'Tất Cả' },
    { id: 'edunext', label: 'EduNext (Đang Mở)' },
    { id: 'khaothi', label: 'Khảo Thí (Sắp Ra Mắt)' },
    { id: 'seb', label: 'SEB (Sắp Ra Mắt)' }
  ];

  return (
    <section id="services" className="py-20 border-t border-slate-800/80 bg-slate-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="emerald" size="md" className="mb-3">
            Hệ Thống Trợ Lý Học Tập FPT
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Kho Dịch Vụ Sinh Viên FPT
          </h2>
          <p className="mt-3 text-slate-400 text-base sm:text-lg">
            Hiện tại hệ thống đang mở hoạt động chính thức cho <strong>FPT EduNext Assistant Pro (v10.2.23)</strong>. Các dịch vụ Khảo Thí và SEB đang trong giai đoạn phát triển và sẽ sớm ra mắt.
          </p>

          {/* Filter Categories */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as ServiceCategory)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border',
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredServices.map(service => {
            const isComingSoon = service.isComingSoon || !service.plans || service.plans.length === 0;
            const activePlanId = selectedPlans[service.id] || (service.plans?.[0]?.id ?? '');
            const currentPlan = service.plans?.find(p => p.id === activePlanId) || service.plans?.[0];
            const discountPct = currentPlan && currentPlan.originalPrice > currentPlan.price && currentPlan.originalPrice > 0
              ? Math.round(((currentPlan.originalPrice - currentPlan.price) / currentPlan.originalPrice) * 100)
              : 0;

            if (isComingSoon) {
              return (
                <div
                  key={service.id}
                  className="rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-950/80 border border-slate-800/80 shadow-lg relative min-h-[460px]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center mb-5 text-slate-500 shadow-inner">
                    {iconMap[service.iconName] || <Clock className="w-8 h-8 text-amber-500/80" />}
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight mb-2">{service.name}</h3>
                  <div className="my-3">
                    <Badge variant="amber" size="md">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      Sắp Ra Mắt
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed mt-2">
                    {service.tagline}
                  </p>
                  <div className="mt-8 pt-6 border-t border-slate-800/80 w-full text-center">
                    <span className="text-xs font-medium text-slate-500">
                      Đang kiểm thử nội bộ • Chưa mở đăng ký thương mại
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={service.id}
                className="rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 relative bg-slate-900/90 border-2 border-emerald-500/50 shadow-xl shadow-emerald-950/30 hover:border-emerald-400"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0 shadow-inner">
                      {iconMap[service.iconName] || <GraduationCap className="w-6 h-6 text-emerald-400" />}
                    </div>
                    <Badge variant="emerald" size="sm">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      Đang Hoạt Động (v10.2.23)
                    </Badge>
                  </div>

                  {/* Title & Tagline */}
                  <h3 className="text-xl font-bold text-white tracking-tight">{service.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {service.tagline}
                  </p>

                  {/* Social Proof Row */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 pb-4 border-b border-slate-800/80">
                    <span className="flex items-center gap-1 font-medium text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{service.rating}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {service.activeUsersCount.toLocaleString('vi-VN')} sinh viên tin dùng
                      </span>
                    </span>
                  </div>

                  {/* Duration Plan Switcher */}
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Chọn Gói Đăng Ký:
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {service.plans.map(plan => {
                        const isSelected = plan.id === activePlanId;
                        return (
                          <button
                            key={plan.id}
                            onClick={() => setSelectedPlans(prev => ({ ...prev, [service.id]: plan.id }))}
                            className={cn(
                              'px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border cursor-pointer flex items-center justify-between',
                              isSelected
                                ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-300 font-semibold shadow-sm'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                            )}
                          >
                            <span className="font-medium">{plan.durationLabel}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">
                                {formatVND(plan.price)}
                              </span>
                              {plan.badge && (
                                <Badge variant={plan.isPopular ? 'indigo' : 'slate'} size="sm">
                                  {plan.badge}
                                </Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Box */}
                  {currentPlan && (
                    <div className="mt-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-2xl font-extrabold text-white">
                            {formatVND(currentPlan.price)}
                          </span>
                          {currentPlan.originalPrice > currentPlan.price && currentPlan.originalPrice > 0 && (
                            <span className="text-xs text-slate-500 line-through ml-2">
                              {formatVND(currentPlan.originalPrice)}
                            </span>
                          )}
                        </div>
                        {discountPct > 0 && (
                          <Badge variant="rose" size="sm">
                            Tiết kiệm {discountPct}%
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Kích hoạt và cấp Key nhanh qua Discord Admin</span>
                      </div>
                    </div>
                  )}

                  {/* Feature Checklist */}
                  <div className="mt-5 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Tính Năng Trọng Tâm:
                    </div>
                    {service.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                        <span className="leading-tight text-slate-300">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  {currentPlan && (
                    <Button
                      onClick={() => onSelectPlan(service, currentPlan)}
                      variant="primary"
                      className="w-full justify-center group/btn shadow-lg shadow-emerald-950/60"
                    >
                      <span>Đăng Ký Ngay — {formatVND(currentPlan.price)}</span>
                      <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
