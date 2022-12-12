import ClipWindow from "@components/clip/ClipWindow";
import TagWindow from "@components/clip/TagWindow";

function Clip() {
  return (
    <div className="relative flex h-full w-full max-w-7xl justify-around gap-2">
      <TagWindow />
      <ClipWindow />
    </div>
  );
}

export default Clip;
