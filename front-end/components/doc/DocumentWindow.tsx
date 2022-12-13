import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";
import { useState } from "react";

interface DocumentDetail {
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

const ResDocumentData: DocumentDetail = {
  id: 0,
  title: "제목입니다.",
  createdAt: new Date(),
  content:
    "<h1>안녕하세요<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></h1>",
  rel: {
    prev: {
      id: 10,
      title: "이것은 이전글 제목입니다."
    },
    next: {
      id: 12,
      title: "이것은 다음글 제목입니다."
    }
  }
};

interface DocumentComment {
  id: number;
  writer: string;
  createdAt: Date;
  content: string;
  child?: DocumentComment[];
}

const DocumentCommentsData: DocumentComment[] = [
  {
    id: 1,
    writer: "김대희",
    createdAt: new Date(),
    content: "안녕하세요!",
    child: [
      {
        id: 2,
        writer: "김대희",
        createdAt: new Date(),
        content: "반갑습니다!"
      }
    ]
  },
  {
    id: 3,
    writer: "김대희",
    createdAt: new Date(),
    content: "좋은 정보 감사합니다!",
    child: [
      {
        id: 4,
        writer: "김대희",
        createdAt: new Date(),
        content: "방문해주셔서 감사합니다!"
      }
    ]
  }
];

interface CommentProps {
  level?: number;
  comment: DocumentComment;
}

function Comment({ level = 0, comment }: CommentProps) {
  console.log("comment");
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const handleClickReplyButton = () => setIsReplyOpen(before => !before);

  return (
    <>
      <div className="w-full p-2 mt-2 flex flex-col gap-y-2 border-2 border-black">
        <div className="flex justify-between flex-wrap">
          <span>{comment.writer}</span>
          <span className="ml-auto">{comment.createdAt.toDateString()}</span>
        </div>
        <div>{comment.content}</div>
        {level === 0 && (
          <button type="button" className="ml-auto px-2 bg-gray-200 border-2 border-black"
                  onClick={handleClickReplyButton}>답글
          </button>
        )}
      </div>
      {comment.child && (
        <div className="relative flex w-full flex-col pl-2">
          {comment.child.map((childComment) => (
            <Comment
              key={childComment.id}
              level={level + 1}
              comment={childComment}
            />
          ))}
          {level === 0 && isReplyOpen && <CommentWrite commentId={comment.id} />}
        </div>
      )}
    </>
  );
}

interface CommentWriteProps {
  commentId?: number;
}

function CommentWrite({ commentId }: CommentWriteProps) {
  return (
    <form className="w-full p-3 mt-2 flex flex-col gap-y-2 border-2 border-black">
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
            autoComplete="none"
            id="password"
          />
        </label>
      </div>
      <textarea
        placeholder="댓글을 입력해주세요"
        className="w-full p-2 outline-0 h-fit border-2 border-black"
      />
      <button type="submit" className="ml-auto px-2 bg-gray-200 border-2 border-black">
        작성
      </button>
    </form>
  );
}

interface PrevNextDocumentProps {
  prev?: {
    id: number;
    title: string;
  };
  next?: {
    id: number;
    title: string;
  };
}

function PrevNextDocument({ prev, next }: PrevNextDocumentProps) {
  return (
    <div className="w-full px-2 my-1 flex justify-between gap-x-2">
      {prev ? (
        <Link href={`/doc/${prev.id}`} rel="prev">
          {"〈 "}
          {prev.title}
        </Link>
      ) : (
        <div>처음 글 입니다.</div>
      )}
      {next ? (
        <Link href={`/doc/${next.id}`} rel="next" className="">
          {next.title}
          {" 〉"}
        </Link>
      ) : (
        <div>마지막 글 입니다.</div>
      )}
    </div>
  );
}

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
        {DocumentCommentsData.map((comment) => (
          <Comment key={comment.id} comment={comment} />
        ))}
        <CommentWrite />
        {/*hr*/}
        <div className="w-full h-0.5 bg-black my-2" />
        {/*이전 글 다음 글*/}
        <PrevNextDocument {...ResDocumentData.rel} />
      </WindowDiv>
    </section>
  );
}
