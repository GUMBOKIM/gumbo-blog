import React from "react";

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="w-full h-full grid grid-cols-5 gap-2">
      <header className="col-span-5 bg-red-500 row-start-1">헤더입니다.</header>
      <nav className="col-span-1 bg-red-400">네비게이션 입니다.</nav>
      <main className="col-span-4 bg-red-300">메인 입니다.</main>
      <footer className="col-span-5 bg-red-200 row-end-auto">
        푸터 입니다.
      </footer>
    </div>
  );
}
