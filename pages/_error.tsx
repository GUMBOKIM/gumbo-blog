import WindowDiv from "@components/window/WindowDiv";
import { ErrorProps } from "next/error";
import { NextPageContext } from "next";
import Link from "next/link";

function Error({ statusCode }: ErrorProps) {
  return (
    <WindowDiv
      title={`${statusCode} Error`}
      className="fixed relative-center w-72 h-40"
    >
      <div className="h-8" />
      <Link href="/home">
        <img
          className="w-8 h-8 m-auto"
          src="/error/error.png"
          alt="error icon"
        />
      </Link>
      <span className="flex items-center justify-center font-chicago">
        {statusCode
          ? `${statusCode} error occurred on server`
          : "error occurred on client"}
      </span>
    </WindowDiv>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
