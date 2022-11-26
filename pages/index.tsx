import styled from "styled-components";

const HomeLogo = styled.div`
  width: 100%;
  height: 100%;
  background: red;
  clip-path: url(#/public/layout/home-logo.svg);
`;

export default function Home() {
  return (
    <>
      <h1 className="text-5xl font-bold underline">Hello world!</h1>
      <div className="relative w-1/2 aspect-[10/3] bg-black">
        <HomeLogo />
      </div>
    </>
  );
}
