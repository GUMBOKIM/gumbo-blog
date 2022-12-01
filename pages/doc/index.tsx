import Folder from "@components/doc/FolderWindow";
import RecentWindow from "@components/doc/RecentWindow";

function Index() {
  return (
    <div className="relative flex h-full w-full max-w-7xl justify-between">
      <section className="relative w-fit max-h-full overflow-scroll py-2">
        <Folder />
      </section>
      <section className="relative w-fit max-h-full overflow-scroll py-2">
        <RecentWindow />
      </section>
    </div>
  );
}

export default Index;
