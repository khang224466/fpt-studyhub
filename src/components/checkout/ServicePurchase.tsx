'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { ServiceCatalog } from '@/components/landing/ServiceCatalog';
import type { ServiceItem, PricingPlan, OrderItem } from '@/types/rental';

const CheckoutModal = dynamic(() => import('./CheckoutModal').then(module => module.CheckoutModal));
const ActivationSuccessModal = dynamic(() => import('./ActivationSuccessModal').then(module => module.ActivationSuccessModal));

export function ServicePurchase() {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [activeOrder, setActiveOrder] = useState<OrderItem | null>(null);
  const [activeLicenseKey, setActiveLicenseKey] = useState<string>('');
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const handleSelectPlan = useCallback((service: ServiceItem, plan: PricingPlan) => {
    setSelectedService(service);
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
  }, []);

  const handlePaymentSuccess = useCallback((order: OrderItem, licenseKey: string) => {
    setIsCheckoutOpen(false);
    setActiveOrder(order);
    setActiveLicenseKey(licenseKey);
    setIsSuccessOpen(true);
  }, []);

  const closeCheckout = useCallback(() => setIsCheckoutOpen(false), []);
  const closeSuccess = useCallback(() => setIsSuccessOpen(false), []);

  return (
    <>
      <ServiceCatalog onSelectPlan={handleSelectPlan} />
      {/* Checkout Payment Modal */}
      {isCheckoutOpen && <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={closeCheckout}
        service={selectedService}
        plan={selectedPlan}
        onPaymentSuccess={handlePaymentSuccess}
      />}

      {/* Success & Draggable Bookmarklet Modal */}
      {isSuccessOpen && <ActivationSuccessModal
        isOpen={isSuccessOpen}
        onClose={closeSuccess}
        order={activeOrder}
        service={selectedService}
        licenseKey={activeLicenseKey}
      />}
    </>
  );
}
