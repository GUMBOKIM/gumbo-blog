import React from "react";

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <header className="w-full flex">
        <div className="flex-0">Logo</div>
        <ul className="flex-1 flex justify-center gap-1">
          <li>메뉴 1</li>
          <li>메뉴 2</li>
          <li>메뉴 3</li>
          <li>메뉴 4</li>
        </ul>
      </header>
      <div className="w-full flex">
        <nav className="flex-0 w-[200px]">
          <ul className="flex-col">
            <li>서브 메뉴 1</li>
            <li>서브 메뉴 2</li>
            <li>서브 메뉴 3</li>
            <li>서브 메뉴 4</li>
          </ul>
        </nav>
        <section className="flex-1">{children}</section>
      </div>
      <footer>ASD</footer>
    </>
  );
}
