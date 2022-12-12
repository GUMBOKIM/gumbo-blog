import Folder from "@components/doc/FolderWindow";
import { useRouter } from "next/router";
import DocumentWindow from "@components/doc/DocumentWindow";

function Document() {
  const router = useRouter();

  return (
    <div className="relative flex h-full w-full max-w-7xl justify-around gap-2">
      <Folder openDocumentId={Number(router.query.documentId)} />
      <DocumentWindow />
    </div>
  );
}

export default Document;
