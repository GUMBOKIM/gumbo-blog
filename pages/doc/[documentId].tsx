import WindowDiv from "@components/window/WindowDiv";
import Folder from "@components/doc/FolderWindow";
import { useRouter } from "next/router";
import Link from "next/link";

interface ResDocumentData {
  id: number;
  title: string;
  createdAt: Date;
  content: string;
  rel?: {
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
      title: "이전글",
    },
    next: {
      id: 12,
      title: "이전글",
    },
  },
};

function Document() {
  const router = useRouter();

  return (
    <div className="relative flex w-full max-w-7xl mx-auto justify-between items-start">
      <Folder openDocumentId={Number(router.query.documentId)} />
      <WindowDiv title="document" className="w-8/12 ml-auto h-fit sm:w-full">
        <h1 className="text-center text-xl my-2 sm:text-base">
          {ResDocumentData.title}
        </h1>
        <span className="text-right block">
          {ResDocumentData.createdAt.toDateString()}
        </span>
        <hr className="border-b-1 border-black my-3" />
        <main dangerouslySetInnerHTML={{ __html: ResDocumentData.content }} />
        <hr className="border-b-1 border-black my-3" />
        {ResDocumentData.rel && (
          <div className="flex flex-col my-1 gap-y-2">
            {ResDocumentData.rel.prev && (
              <Link href={`/doc/${ResDocumentData.rel.prev}`} rel="prev">
                위로가는 아이콘 - 이전글
              </Link>
            )}
            {ResDocumentData.rel.next && (
              <Link
                href={`/doc/${ResDocumentData.rel.next}`}
                rel="next"
                className=""
              >
                아래로가는 아이콘 - 다음글
              </Link>
            )}
          </div>
        )}
      </WindowDiv>
    </div>
  );
}

export default Document;
