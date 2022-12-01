import React from "react";
import Header from "@components/layout/header/Header";
import Footer from "@components/layout/footer/Footer";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <section className="relative w-screen min-h-screen flex flex-col rounded-2xl border-b-2 border-black bg-dot">
      <Header />
      <main className="flex-1 relative w-full h-full max-w-7xl mx-auto p-2 flex gap-2">
        {children}
      </main>
      <Footer />
    </section>
  );
}
