import Link from "next/link";
import HomeLogo from "@public/layout/home-logo.svg";
import React, { useState } from "react";
import Watch from "@components/layout/header/Watch";
import { useRouter } from "next/router";

const MenuList = ["home", "about", "post", "doc", "clip", "resume"];

function NavMenu({ menuName, nowPath }: { menuName: string; nowPath: string }) {
  if (menuName === "resume") {
    return (
      <a
        className="text-center hover:text-gray-700 text-gray-500"
        href="https://resume.gumbo.kr"
        target="_blank"
        rel="bookmark noreferrer"
      >
        {menuName}
      </a>
    );
  }

  return (
    <Link
      className={`text-center hover:text-gray-700 ${
        nowPath.includes(menuName) ? "text-gray-900" : "text-gray-500"
      }`}
      href={`/${menuName}`}
    >
      {menuName}
    </Link>
  );
}

export default function Header() {
  const router = useRouter();
  const nowPath = router.asPath;

  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  return (
    <>
      <div className="absolute w-full h-8 bg-black" />
      <header className="absolute w-full h-8 px-5 flex items-center gap-x-5 bg-white rounded-t-2xl border-b-2 border-black z-50 font-chicago">
        <Link className="h-6 aspect-[10/3]" href="/">
          <HomeLogo />
        </Link>
        {/*일반 메뉴*/}
        <nav className="flex gap-x-3 text-sm 2sm:hidden">
          {MenuList.map((menu) => (
            <NavMenu key={menu} menuName={menu} nowPath={nowPath} />
          ))}
        </nav>
        {/*화면 작을때 메뉴 버튼*/}
        <div className="ml-auto hidden 2sm:block z-10">
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
            className={`absolute top-7 right-2  w-28 p-2 bg-white border-black border-2 flex flex-col gap-y-2  ${
              isNavOpen ? "block" : "hidden"
            }`}
          >
            {MenuList.map((menu) => (
              <NavMenu key={menu} menuName={menu} nowPath={nowPath} />
            ))}
          </nav>
        </div>
        <Watch />
      </header>
    </>
  );
}
