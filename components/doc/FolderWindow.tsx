import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";

interface DocumentFile {
  id: number;
  name: string;
  order: number;
  type: "folder" | "document";
  children?: DocumentFile[];
}

const DocumentFilesData: DocumentFile[] = [
  {
    id: 1,
    name: "javascript",
    order: 1,
    type: "folder",
    children: [
      {
        id: 2,
        name: "basic",
        order: 1,
        type: "folder",
        children: [
          {
            id: 3,
            name: "자료형",
            order: 1,
            type: "document",
          },
          {
            id: 4,
            name: "연산자",
            order: 2,
            type: "document",
          },
        ],
      },
      {
        id: 5,
        name: "클로져",
        order: 2,
        type: "document",
      },
      {
        id: 6,
        name: "콘텍스트",
        order: 3,
        type: "document",
      },
    ],
  },
  {
    id: 5,
    name: "typescript",
    order: 2,
    type: "folder",
    children: [
      {
        id: 7,
        name: "basic",
        order: 1,
        type: "folder",
        children: [
          {
            id: 8,
            name: "슈퍼셋",
            order: 1,
            type: "document",
          },
          {
            id: 9,
            name: "모르겟다",
            order: 2,
            type: "document",
          },
        ],
      },
      {
        id: 10,
        name: "뭘까",
        order: 2,
        type: "document",
      },
      {
        id: 11,
        name: "진짜 모름",
        order: 3,
        type: "document",
      },
    ],
  },
];

interface DocumentProps {
  level?: number;
  openDocumentId?: number;
  file: DocumentFile;
}

function Document({ level = 0, openDocumentId, file }: DocumentProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (file.type === "folder") {
    return (
      <>
        <button
          type="button"
          className={`flex ml-3 items-center ${!isOpen && "underline"}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <img
            src={`/icon/mac/${level === 0 ? "global_folder" : "folder"}.png`}
            alt={`${file.name} folder`}
            className="h-4 mr-2"
          />
          <span>{file.name}</span>
        </button>
        <div className="flex-col ml-3">
          {isOpen &&
            file.children?.map((child) => (
              <Document
                key={child.id}
                openDocumentId={openDocumentId}
                level={level + 1}
                file={child}
              />
            ))}
        </div>
      </>
    );
  }

  return (
    <Link href={`/doc/${file.id}`} className="flex ml-3 items-center">
      <img
        src="/icon/mac/file.png"
        alt={`${file.name} file`}
        className="h-4 mr-2"
      />
      <span className={openDocumentId === file.id ? "font-bold" : ""}>
        {file.name}
      </span>
    </Link>
  );
}

export default function FolderWindow() {
  const { query } = useRouter();
  const documentId = Number(query.documentId);

  return (
    <section className="relative w-full max-w-xs max-h-full overflow-scroll py-2 lg:hidden">
      <WindowDiv title="folder" className="w-full h-fit">
        <nav className="flex flex-col w-full mb-auto select-none">
          {DocumentFilesData.map((documentFile) => (
            <Document
              key={documentFile.id}
              openDocumentId={documentId}
              file={documentFile}
            />
          ))}
        </nav>
      </WindowDiv>
    </section>
  );
}
