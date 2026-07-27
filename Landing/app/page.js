import Header from "./components/Header";
import Hero from "./components/Hero";
import WhyChooseUs from "./components/WhyChooseUs";
import ServicePackages from "./components/ServicePackages";
import Branches from "./components/Branches";
import MaintenanceTips from "./components/MaintenanceTips";
import Testimonials from "./components/Testimonials";
import CustomerRequestForm from "./components/CustomerRequestForm";
import ClosingCta from "./components/ClosingCta";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="snap-container">
        <Hero />
        <WhyChooseUs />
        <ServicePackages />
        <Branches />
        <MaintenanceTips />
        <Testimonials />
        <CustomerRequestForm />
        <ClosingCta />
      </main>
    </>
  );
}
