import Link from "next/link";
import HomeLogo from "@public/layout/home-logo.svg";
import React, { useState } from "react";
import Watch from "@components/layout/header/Watch";

const MenuList = ["Home", "About", "Post", "Doc", "Clip", "Resume"];

export default function Header() {
  const [nowSelectedMenu, setNowSelectedMenu] = useState<string>("Home");
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  return (
    <header className="w-full h-8 px-5 flex items-center gap-x-5 bg-white rounded-t-2xl border-b-2 border-black font-chicago">
      <Link className="h-6 aspect-[10/3]" href="/">
        <HomeLogo />
      </Link>
      {/*일반 메뉴*/}
      <nav className="flex gap-x-3 text-sm 2sm:hidden">
        {MenuList.map((menu) => (
          <Link
            key={menu}
            className={`text-center hover:text-gray-700 ${
              nowSelectedMenu === menu ? "text-gray-900" : "text-gray-500"
            }`}
            onClick={() => setNowSelectedMenu(menu)}
            href="/"
          >
            {menu}
          </Link>
        ))}
      </nav>
      {/*화면 작을때 메뉴 버튼*/}
      <div className="ml-auto hidden 2sm:block">
        <button
          className={`relative w-5 h-5 p-0 m-0 text-sm border-2 ${
            isNavOpen ? "border-transparent" : "border-black"
          }`}
          onClick={() => setIsNavOpen(!isNavOpen)}
          type="button"
        >
          -
        </button>
        <nav
          className={`absolute top-7 right-2 p-2 flex flex-col gap-y-2 window ${
            isNavOpen ? "block" : "hidden"
          }`}
        >
          {MenuList.map((menu) => (
            <Link
              key={menu}
              className={`text-center hover:text-gray-700 ${
                nowSelectedMenu === menu ? "text-gray-900" : "text-gray-500"
              }`}
              onClick={() => {
                setNowSelectedMenu(menu);
                setIsNavOpen(false);
              }}
              href="/"
            >
              {menu}
            </Link>
          ))}
        </nav>
      </div>
      <Watch />
    </header>
  );
}
