import Folder from "@components/doc/FolderWindow";
import DocumentWindow from "@components/doc/DocumentWindow";

function Document() {

  return (
    <div className="relative flex h-full w-full max-w-7xl justify-around gap-2">
      <Folder />
      <DocumentWindow />
    </div>
  );
}

export default Document;
