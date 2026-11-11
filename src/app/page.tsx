import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { DemoVideoTrailer } from '@/components/landing/DemoVideoTrailer';
import { ServicePurchase } from '@/components/checkout/ServicePurchase';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { SecurityPledge } from '@/components/landing/SecurityPledge';
import { FaqSection } from '@/components/landing/FaqSection';
import { Footer } from '@/components/landing/Footer';

export default function HomePage() {

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-300">
      <Navbar />

      <main className="flex-1">
        <HeroSection />
        <DemoVideoTrailer />
        <ServicePurchase />
        <HowItWorks />
        <ComparisonTable />
        <SecurityPledge />
        <FaqSection />
      </main>

      <Footer />


    </div>
  );
}
