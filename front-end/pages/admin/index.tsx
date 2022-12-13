import WindowDiv from "@components/window/WindowDiv";

const isLogin = false;

function Index() {

  if (!isLogin) {
    return (
      <WindowDiv title="login">
        <form className="w-full flex flex-col items-center gap-y-2">
          <label htmlFor="id">
            <span className="inline-block w-8">ID</span>
            <input className="px-2 w-40 outline-0 border-2 border-black" type="text" />
          </label>
          <label htmlFor="pw">
            <span className="inline-block w-8">PW</span>
            <input className="px-2 w-40 outline-0 border-2 border-black" type="password" />
          </label>
          <button type="submit" className="bg-gray-200 mt-6 border-2 border-black px-2">submit</button>
        </form>
      </WindowDiv>
    );
  }

  return (
    <WindowDiv title="menu" />
  );
}

export default Index;
