'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { DemoVideoTrailer } from '@/components/landing/DemoVideoTrailer';
import { ServiceCatalog } from '@/components/landing/ServiceCatalog';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { SecurityPledge } from '@/components/landing/SecurityPledge';
import { FaqSection } from '@/components/landing/FaqSection';
import { Footer } from '@/components/landing/Footer';
import { CheckoutModal } from '@/components/checkout/CheckoutModal';
import { ActivationSuccessModal } from '@/components/checkout/ActivationSuccessModal';
import { ServiceItem, PricingPlan, OrderItem } from '@/types/rental';

export default function HomePage() {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [activeOrder, setActiveOrder] = useState<OrderItem | null>(null);
  const [activeLicenseKey, setActiveLicenseKey] = useState<string>('');
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const handleSelectPlan = (service: ServiceItem, plan: PricingPlan) => {
    setSelectedService(service);
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
  };

  const handlePaymentSuccess = (order: OrderItem, licenseKey: string) => {
    setIsCheckoutOpen(false);
    setActiveOrder(order);
    setActiveLicenseKey(licenseKey);
    setIsSuccessOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar />

      <main className="flex-1">
        <HeroSection />
        <DemoVideoTrailer />
        <ServiceCatalog onSelectPlan={handleSelectPlan} />
        <HowItWorks />
        <ComparisonTable />
        <SecurityPledge />
        <FaqSection />
      </main>

      <Footer />

      {/* Checkout Payment Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        service={selectedService}
        plan={selectedPlan}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Success & Draggable Bookmarklet Modal */}
      <ActivationSuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        order={activeOrder}
        service={selectedService}
        licenseKey={activeLicenseKey}
      />
    </div>
  );
}
