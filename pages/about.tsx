import WindowDiv from "@components/window/WindowDiv";

function About() {
  return (
    <WindowDiv title="about" className="w-80">
      <img src="/about/profile.png" className="mx-auto my-6" alt="profile" />
      <p className="text-center mb-5">
        개발이 즐겁다!
        <br />
        안녕하세요 개발자 Gumbo입니다.
        <br />
        개발 관련 정보를 정리한 개인블로그로
        <br />
        NextJS를 사용해 제작하였습니다.
        <br />
        소스코드는 아래 링크에 있습니다.
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
