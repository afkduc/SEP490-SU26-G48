import Header from "./components/Header";
import Hero from "./components/Hero";
import MaintenanceTips from "./components/MaintenanceTips";
import CustomerRequestForm from "./components/CustomerRequestForm";
import ClosingCta from "./components/ClosingCta";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="snap-container">
        <Hero />
        <MaintenanceTips />
        <CustomerRequestForm />
        <ClosingCta />
      </main>
    </>
  );
}
