import Folder from "@components/doc/FolderWindow";
import { useRouter } from "next/router";
import DocumentWindow from "@components/doc/DocumentWindow";

function Document() {
  const router = useRouter();

  return (
    <>
      <Folder openDocumentId={Number(router.query.documentId)} />
      <DocumentWindow />
    </>
  );
}

export default Document;
