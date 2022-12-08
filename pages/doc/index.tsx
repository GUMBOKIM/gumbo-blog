import Folder from "@components/doc/FolderWindow";
import RecentWindow from "@components/doc/RecentWindow";

function Index() {
  return (
    <div className="relative flex h-full w-full max-w-7xl justify-around gap-2">
      <Folder />
      <RecentWindow />
    </div>
  );
}

export default Index;
