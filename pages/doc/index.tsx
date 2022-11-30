import WindowDiv from "@components/window/WindowDiv";
import Folder from "@components/doc/Folder";
import Link from "next/link";

function Index() {
  return (
    <>
      <Folder />
      <WindowDiv title="recent" className="h-full w-full max-w-7xl sm:w-full">
        <div className="py-10">
          <Link href={`/doc/${10}`}>
            <article className="block w-full max-w-2xl mx-auto my-5 hover:text-zinc-500 hover:cursor-pointer select-none">
              <h1 className="text-xl font-semibold mb-1">제목</h1>
              <span className="block text-right text-sm font-light mb-3">
                {new Date().toDateString()}
              </span>
              <desc className="w-full text-sm ">
                <p className="h-20 overflow-hidden">
                  테스트용 글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다. 테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다. 테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.
                </p>
              </desc>
              <div className="flex flex-row my-5">
                <img
                  src="/icon/mac/folder.png"
                  alt="folder"
                  className="ml-auto mr-2 w-4 h-4 translate-y-1"
                />
                <span>javascript</span>
              </div>
            </article>
          </Link>
          <Link href={`/doc/${10}`}>
            <article className="block w-full max-w-2xl mx-auto my-5 hover:text-zinc-500 hover:cursor-pointer select-none">
              <h1 className="text-xl font-semibold mb-1">제목</h1>
              <span className="block text-right text-sm font-light mb-3">
                {new Date().toDateString()}
              </span>
              <desc className="w-full text-sm ">
                <p className="h-20 overflow-hidden">
                  테스트용 글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다. 테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다. 테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.
                </p>
              </desc>
              <div className="flex flex-row my-5">
                <img
                  src="/icon/mac/folder.png"
                  alt="folder"
                  className="ml-auto mr-2 w-4 h-4 translate-y-1"
                />
                <span>javascript</span>
              </div>
            </article>
          </Link>
          <Link href={`/doc/${10}`}>
            <article className="block w-full max-w-2xl mx-auto my-5 hover:text-zinc-500 hover:cursor-pointer select-none">
              <h1 className="text-xl font-semibold mb-1">제목</h1>
              <span className="block text-right text-sm font-light mb-3">
                {new Date().toDateString()}
              </span>
              <desc className="w-full text-sm ">
                <p className="h-20 overflow-hidden">
                  테스트용 글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다. 테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다. 테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.테스트용
                  글입니다.테스트용 글입니다.테스트용 글입니다.
                </p>
              </desc>
              <div className="flex flex-row my-5">
                <img
                  src="/icon/mac/folder.png"
                  alt="folder"
                  className="ml-auto mr-2 w-4 h-4 translate-y-1"
                />
                <span>javascript</span>
              </div>
            </article>
          </Link>
        </div>
      </WindowDiv>
    </>
  );
}

export default Index;
