import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";
import { useState } from "react";

interface GlobalFolder {
  folders: FolderWindow[];
}

interface FolderWindow {
  id: number;
  title: string;
  folders?: FolderWindow[];
  documents?: Document[];
}

interface Document {
  id: number;
  title: string;
}

interface FolderListProps {
  openDocumentId?: number;
}

const DocsData: FolderWindow[] = [
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

export default function FolderWindow({ openDocumentId }: FolderListProps) {
  const [openFolders, setOpenFolders] = useState<number[]>([]);

  const handleClickFolder = (folderId: number) => {
    if (openFolders?.includes(folderId)) {
      setOpenFolders((before) => before.filter((nowId) => nowId !== folderId));
    } else {
      setOpenFolders((before) => [...before, folderId]);
    }
  };

  return (
    <WindowDiv title="folder" className="w-20 h-fit md:hidden ">
      <nav className="flex flex-col w-full mb-auto gap-1 select-none">
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
              {folder.documents?.map((document) => (
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
