import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";
import { useState } from "react";

interface Folder {
  id: number;
  title: string;
  documents: Document[];
}

interface Document {
  id: number;
  title: string;
}

const DocsData: Folder[] = [
  {
    id: 1,
    title: "javascript",
    documents: [
      {
        id: 1,
        title:
          "클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져 클로져",
      },
      {
        id: 2,
        title: "함수",
      },
      {
        id: 3,
        title: "자료형",
      },
    ],
  },
  {
    id: 2,
    title: "typescript",
    documents: [
      {
        id: 4,
        title: "클로져",
      },
      {
        id: 5,
        title: "함수",
      },
      {
        id: 6,
        title: "자료형",
      },
    ],
  },
];

interface FolderListProps {
  openDocumentId?: number;
}

export default function Folder({ openDocumentId }: FolderListProps) {
  const [openFolders, setOpenFolders] = useState<number[]>([]);

  const handleClickFolder = (folderId: number) => {
    if (openFolders?.includes(folderId)) {
      setOpenFolders((before) => before.filter((nowId) => nowId !== folderId));
    } else {
      setOpenFolders((before) => [...before, folderId]);
    }
  };

  return (
    <WindowDiv title="list" className="w-72 h-fit md:hidden">
      <nav className="block gap-1">
        {DocsData.map((folder) => (
          <ul key={folder.id} className="flex flex-col gap-1">
            <button
              className="flex items-center"
              type="button"
              onClick={() => handleClickFolder(folder.id)}
            >
              <img
                src="/icon/mac/folder.png"
                alt={`${folder.title} folder`}
                className="h-4 mr-2"
              />
              <span>{folder.title}</span>
            </button>
            <ol
              key={folder.id}
              className={`text-sm flex flex-col gap-1 ml-4 ${
                openFolders?.includes(folder.id) ? "block" : "hidden"
              }`}
            >
              {folder.documents.map((document) => (
                <li key={document.id}>
                  <Link
                    href={`/doc/${document.id}`}
                    className="flex items-start"
                  >
                    <img
                      src="/icon/mac/file.png"
                      alt={`${folder.title} folder`}
                      className="h-4 mr-2"
                    />
                    <span
                      className={`text-gray-500 hover:text-gray-700  ${
                        document.id === openDocumentId && "text-black"
                      }`}
                    >
                      {document.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </ul>
        ))}
      </nav>
    </WindowDiv>
  );
}
