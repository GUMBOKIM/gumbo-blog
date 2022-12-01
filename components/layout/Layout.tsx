import React from "react";
import Header from "@components/layout/header/Header";
import Footer from "@components/layout/footer/Footer";
import Body from "@components/layout/body/Body";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <section className="relative w-screen h-screen flex flex-col rounded-2xl border-b-2 bg-dot">
      <Header />
      <Body>{children}</Body>
      <Footer />
    </section>
  );
}
