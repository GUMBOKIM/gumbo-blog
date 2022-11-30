import WindowDiv from "@components/window/WindowDiv";
import Folder from "@components/doc/Folder";
import { useRouter } from "next/router";

interface ResDocumentData {
  id: number;
  title: string;
  createdAt: Date;
  content: string;
}

const ResDocumentData: ResDocumentData = {
  id: 0,
  title: "제목입니다.",
  createdAt: new Date(),
  content:
    "<h1>안녕하세요<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></h1>",
};

function Document() {
  const router = useRouter();

  return (
    <>
      <Folder openDocumentId={Number(router.query.documentId)} />
      <WindowDiv title="document" className="w-full max-w-7xl sm:w-full">
        <h1 className="text-center text-xl my-2 sm:text-base">
          {ResDocumentData.title}
        </h1>
        <span className="text-right block">
          {ResDocumentData.createdAt.toDateString()}
        </span>
        <hr className="border-b-1 border-black my-3" />
        <main dangerouslySetInnerHTML={{ __html: ResDocumentData.content }} />
      </WindowDiv>
    </>
  );
}

export default Document;
