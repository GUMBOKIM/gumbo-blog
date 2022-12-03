import Link from "next/link";
import WindowDiv from "@components/window/WindowDiv";

interface RecentDocumentProps {
  id: number;
  title: string;
  category: string;
  createdAt: Date;
  content: string;
}

function RecentDocument({
  id,
  title,
  category,
  createdAt,
  content,
}: RecentDocumentProps) {
  return (
    <Link href={`/doc/${id}`} className="relative w-full max-w-xl mx-auto">
      <article className="hover:text-zinc-500 hover:cursor-pointer select-none">
        <h1 className="font-semibold mb-1">{title}</h1>
        <span className="w-fit block text-right text-sm font-light mb-3">
          {createdAt.toDateString()}
        </span>
        <desc className="w-full text-sm">
          <p className="h-20 overflow-hidden whitespace-pre-wrap">{content}</p>
        </desc>
        <div className="flex flex-row my-5">
          <img
            src="/icon/mac/folder.png"
            alt="folder"
            className="ml-auto mr-2 w-4 h-4 translate-y-1"
          />
          <span>{category}</span>
        </div>
      </article>
    </Link>
  );
}

export default function RecentWindow() {
  const RecentDocuments: RecentDocumentProps[] = [
    {
      id: 10,
      title: "안녕하세요",
      category: "javascript",
      createdAt: new Date(),
      content: `안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 안녕하세요 
      안녕하세요
      안녕하세요
      안녕하세요
      안녕하세요
      안녕하세요`,
    },
    {
      id: 11,
      title: "안녕하세요",
      category: "javascript",
      createdAt: new Date(),
      content: `안녕하세요 
      안녕하세요
      안녕하세요
      안녕하세요
      안녕하세요
      안녕하세요`,
    },
    {
      id: 12,
      title: "안녕하세요",
      category: "javascript",
      createdAt: new Date(),
      content: `안녕하세요 
      안녕하세요
      안녕하세요
      안녕하세요
      안녕하세요
      안녕하세요`,
    },
  ];

  return (
    <section className="relative w-full max-w-4xl max-h-full overflow-scroll py-2">
      <WindowDiv title="recent" className="w-full">
        <div className="relative flex flex-col w-full p-3 max-w-96 max-auto">
          {RecentDocuments.map((recentDocument) => (
            <RecentDocument key={recentDocument.id} {...recentDocument} />
          ))}
        </div>
      </WindowDiv>
    </section>
  );
}
