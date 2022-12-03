import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";

interface ResDocumentData {
  id: number;
  title: string;
  createdAt: Date;
  content: string;
  rel: {
    prev?: {
      id: number;
      title: string;
    };
    next?: {
      id: number;
      title: string;
    };
  };
}

const ResDocumentData: ResDocumentData = {
  id: 0,
  title: "제목입니다.",
  createdAt: new Date(),
  content:
    "<h1>안녕하세요<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></h1>",
  rel: {
    prev: {
      id: 10,
      title: "이것은 이전글 제목입니다.",
    },
    next: {
      id: 12,
      title: "이것은 다음글 제목입니다.",
    },
  },
};

export default function DocumentWindow() {
  return (
    <section className="relative w-full max-w-4xl max-h-full overflow-scroll py-2">
      <WindowDiv title="document" className="w-full">
        <h1 className="text-center text-xl mt-8 my-2 sm:text-base">
          {ResDocumentData.title}
        </h1>
        <span className="ml-auto my-1">
          {ResDocumentData.createdAt.toDateString()}
        </span>
        {/*hr*/}
        <div className="w-full h-0.5 bg-black" />
        {/*내용*/}
        <main
          className="w-full max-w-full p-2"
          dangerouslySetInnerHTML={{ __html: ResDocumentData.content }}
        />
        {/*hr*/}
        <div className="w-full h-0.5 bg-black" />
        {/*댓글*/}
        <div className="w-full px-3 py-4 flex flex-col gap-y-2">
          <div className="w-full p-2 flex flex-col gap-y-2 border-2 border-black">
            <div className="flex justify-between flex-wrap">
              <span>김대희김대희김대희</span>
              <span className="ml-auto">{new Date().toDateString()}</span>
            </div>
            <div>댓글 내용입니다.</div>
          </div>
          <div className="w-full p-2 flex flex-col gap-y-2 border-2 border-black">
            <div className="flex justify-between flex-wrap">
              <span>김대희김대희김대희</span>
              <span className="ml-auto">{new Date().toDateString()}</span>
            </div>
            <div>댓글 내용입니다.</div>
          </div>
          <div className="w-full p-3 flex flex-col gap-y-2 border-2 border-black">
            <div className="flex justify-between flex-wrap">
              <span>김대희김대희김대희</span>
              <span className="ml-auto">{new Date().toDateString()}</span>
            </div>
            <span className="px-1">
              댓글 내용입니다.댓글 내용입니다.댓글 내용입니다.댓글
              내용입니다.댓글 내용입니다.댓글 내용입니다. 댓글 내용입니다.댓글
              내용입니다.댓글 내용입니다.댓글 내용입니다.댓글 내용입니다.댓글
              내용입니다. 댓글 내용입니다.댓글 내용입니다.댓글 내용입니다.댓글
              내용입니다.댓글 내용입니다.댓글 내용입니다. 댓글 내용입니다.댓글
              내용입니다.댓글 내용입니다.댓글 내용입니다.댓글 내용입니다.댓글
              내용입니다. 댓글 내용입니다.댓글 내용입니다.댓글 내용입니다.댓글
              내용입니다.댓글 내용입니다.댓글 내용입니다.
            </span>
          </div>
          <div className="w-full p-3 flex flex-col gap-y-2 border-2 border-black">
            <div className="w-full flex gap-4 flex-wrap">
              <label className="flex gap-3" htmlFor="name">
                <span>이름</span>
                <input
                  className="px-1 outline-0 border-2 border-black w-20"
                  type="text"
                />
              </label>
              <label className="flex gap-x-2" htmlFor="password">
                <span>암호</span>
                <input
                  className="px-1 outline-0 border-2 border-black w-20"
                  type="password"
                  id="password"
                />
              </label>
            </div>
            <textarea
              placeholder="댓글을 입력해주세요"
              className="w-full p-2 outline-0 h-fit border-2 border-black"
            />
            <button
              type="submit"
              className="ml-auto w-10 border-2 border-black"
            >
              작성
            </button>
          </div>
        </div>
        {/*hr*/}
        <div className="w-full h-0.5 bg-black" />
        {/*이전 글 다음 글*/}
        <div className="w-full px-2 my-1 flex justify-between gap-x-2">
          {ResDocumentData.rel.prev ? (
            <Link href={`/doc/${ResDocumentData.rel.prev.id}`} rel="prev">
              {"〈 "}
              {ResDocumentData.rel.prev.title}
            </Link>
          ) : (
            <div>처음 글 입니다.</div>
          )}
          {ResDocumentData.rel.next ? (
            <Link
              href={`/doc/${ResDocumentData.rel.next.id}`}
              rel="next"
              className=""
            >
              {ResDocumentData.rel.next.title}
              {" 〉"}
            </Link>
          ) : (
            <div>마지막 글 입니다.</div>
          )}
        </div>
      </WindowDiv>
    </section>
  );
}
