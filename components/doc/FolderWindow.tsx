import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";
import { useState } from "react";

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
    folders: [],
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
    <>
      <section className="relative w-full max-w-xs max-h-full overflow-scroll py-2 lg:hidden">
        <WindowDiv title="folder" className="w-full h-fit">
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
                          className={`text-black hover:text-gray-700  ${
                            document.id === openDocumentId && "font-bold"
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
      </section>
      {/*<section className="fixed right-0 w-full bottom-0 p-4 hidden lg:flex z-50 flex-col-reverse items-end gap-y-2">*/}
      {/*  <button*/}
      {/*    type="button"*/}
      {/*    className="border-2 border-black w-6 h-6 bg-white p-0 flex items-center justify-center"*/}
      {/*  >*/}
      {/*    =*/}
      {/*  </button>*/}
      {/*  <div className="max-h-full w-full border-black border-2 bg-white">*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span>*/}
      {/*    <br />*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span>*/}
      {/*    <br />*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span> <br />*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span> <br />*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span> <br />*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span> <br />*/}
      {/*    <span>asdasdasdasdasdasdasdasdasdasdasd</span>*/}
      {/*  </div>*/}
      {/*</section>*/}
    </>
  );
}
