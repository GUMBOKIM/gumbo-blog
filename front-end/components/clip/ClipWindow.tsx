import WindowDiv from "@components/window/WindowDiv";
import Link from "next/link";

interface Clip {
  tag: string;
  infos: {
    id: number;
    title: string;
    url: string;
    createdAt: Date;
  }[];
}

const ClipData: Clip[] = [
  {
    tag: "react",
    infos: [
      { id: 1, title: "벨로퍼트1", url: "ASDF", createdAt: new Date() },
      { id: 2, title: "벨로퍼트2", url: "ASDF", createdAt: new Date() },
      { id: 3, title: "벨로퍼트3", url: "ASDF", createdAt: new Date() },
      { id: 4, title: "벨로퍼트4", url: "ASDF", createdAt: new Date() },
      { id: 5, title: "벨로퍼트5", url: "ASDF", createdAt: new Date() },
      { id: 6, title: "벨로퍼트6", url: "ASDF", createdAt: new Date() },
      { id: 7, title: "벨로퍼트7", url: "ASDF", createdAt: new Date() },
      { id: 8, title: "벨로퍼트8", url: "ASDF", createdAt: new Date() },
      { id: 9, title: "벨로퍼트9", url: "ASDF", createdAt: new Date() },
    ],
  },
  {
    tag: "javascript",
    infos: [
      { id: 1, title: "벨로퍼트1", url: "ASDF", createdAt: new Date() },
      { id: 2, title: "벨로퍼트2", url: "ASDF", createdAt: new Date() },
      { id: 3, title: "벨로퍼트3", url: "ASDF", createdAt: new Date() },
      { id: 4, title: "벨로퍼트4", url: "ASDF", createdAt: new Date() },
      { id: 5, title: "벨로퍼트5", url: "ASDF", createdAt: new Date() },
      { id: 6, title: "벨로퍼트6", url: "ASDF", createdAt: new Date() },
      { id: 7, title: "벨로퍼트7", url: "ASDF", createdAt: new Date() },
      { id: 8, title: "벨로퍼트8", url: "ASDF", createdAt: new Date() },
      { id: 9, title: "벨로퍼트9", url: "ASDF", createdAt: new Date() },
    ],
  },
];

export default function ClipWindow() {
  return (
    <section className="relative w-full max-w-4xl max-h-full overflow-scroll py-2">
      <WindowDiv title="Clip" className="w-full">
        <div className="w-full flex flex-col gap-y-5 p-4">
          {ClipData.map((clip) => (
            <div className="w-full" key={clip.tag}>
              <span className="text-2xl">{clip.tag}</span>
              <hr />
              <div className="flex flex-col gap-y-1">
                {clip.infos.map((info) => (
                  <div className="flex flex-col gap-y-1" key={info.id}>
                    <div>
                      <span>{info.title}</span>
                      <span className="ml-auto">
                        {info.createdAt.toDateString()}
                      </span>
                    </div>
                    <Link href={info.url} className="underline">
                      {info.url}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </WindowDiv>
    </section>
  );
}
