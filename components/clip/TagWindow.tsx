import WindowDiv from "@components/window/WindowDiv";
import { useState } from "react";

interface Tag {
  name: string;
  count: number;
}

const TagData: Tag[] = [
  {
    name: "react",
    count: 20,
  },
  {
    name: "javascript",
    count: 30,
  },
  {
    name: "typescript",
    count: 30,
  },
  {
    name: "test",
    count: 30,
  },
  {
    name: "nextjs",
    count: 30,
  },
];

export default function TagWindow() {
  const [selectTags, setSelectTags] = useState<string[]>([]);

  const handleClickTag = (tag: string) => {
    setSelectTags((before) =>
      before.includes(tag)
        ? before.filter((beforeTag) => beforeTag !== tag)
        : [tag, ...before],
    );
  };

  return (
    <section className="relative w-full max-w-xs max-h-full overflow-scroll py-2 lg:hidden">
      <WindowDiv title="tags" className="w-full h-fit">
        <nav className="flex flex-col w-full mx-auto gap-1 select-none py-2 gap-y-2">
          {TagData.map((tag) => (
            <div key={tag.name}>
              <button
                type="button"
                className={`px-2 border-2 border-black rounded-xl mr-2 ${
                  selectTags.includes(tag.name) ? "bg-gray-200" : "bg-white"
                }`}
                onClick={() => handleClickTag(tag.name)}
              >
                {tag.name}
              </button>
              <span>{tag.count}</span>
            </div>
          ))}
        </nav>
      </WindowDiv>
    </section>
  );
}
