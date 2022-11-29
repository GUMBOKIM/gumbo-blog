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
      <main className="relative flex-1 self-stretch p-2">{children}</main>
      <Footer />
    </section>
  );
}
