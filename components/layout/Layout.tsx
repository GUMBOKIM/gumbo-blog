import React, { useState } from "react";
import Link from "next/link";

type Props = {
  children: React.ReactNode;
};

const MenuList = ["Home", "About", "Post", "Doc", "Clip", "Resume"];

export default function Layout({ children }: Props) {
  const [nowMenu, setNowMenu] = useState<string>("Home");

  return (
    <>
      <section className="max-w-5xl mx-auto">
        <header className="relative w-full h-10  mt-3 p-0 flex items-center">
          <div>로고</div>
          <nav className="absolute -bottom-0.5 right-0 h-full ml-auto flex gap-x-1">
            {MenuList.map((menu) => (
              <Link
                key={menu}
                className={`h-full w-20 flex justify-center items-center border-2  border-black ${
                  nowMenu === menu ? "border-b-0 bg-gray-300" : "bg-gray-400"
                }`}
                onClick={() => setNowMenu(menu)}
                href={`/`}
              >
                {menu}
              </Link>
            ))}
          </nav>
        </header>
        <main className="w-full h-screen bg-red-300 border-2 border-black bg-gray-300">
          {children}
        </main>
      </section>
      <footer className="flex flex-col mx-auto mt-3">
        <div>푸터 입니다.</div>
        <div>푸터 입니다.</div>
        <div>푸터 입니다.</div>
      </footer>
    </>
  );
}
