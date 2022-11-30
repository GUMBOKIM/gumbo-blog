import WindowDiv from "@components/window/WindowDiv";

function About() {
  return (
    <WindowDiv title="about" className="absolute relative-center w-80">
      <img src="/about/profile.png" className="mx-auto my-6" alt="profile" />
      <h1 className="text-center  mb-5">
        안녕하세요!
        <br />
        개발을 즐기는 개발자 Gumbo입니다.
      </h1>
      <p className="text-center mb-5">
        개발관련 정보를 개인적으로 정리하고자
        <br />
        블로그를 NextJS를 사용해 제작했습니다.
        <br />
        소스코드는 아래에 링크에 있습니다.
      </p>
      <a
        href="https://github.com/GUMBOKIM/gumbo-blog"
        target="_blank"
        rel="bookmark noreferrer"
      >
        <img
          src="/icon/github.png"
          alt="github"
          className="mx-auto mb-5 w-6 h-6"
        />
      </a>
    </WindowDiv>
  );
}

export default About;
