import React from "react";
import Header from "@components/layout/header/Header";
import Footer from "@components/layout/footer/Footer";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <section className="w-screen min-h-screen flex flex-col rounded-2xl border-b-2 border-black bg-dot">
      <Header />
      <main className="p-2 max-w-6xl bg-red-900">{children}</main>
      <Footer />
    </section>
  );
}
