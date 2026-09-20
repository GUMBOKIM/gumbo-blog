# gumbo.log

https://blog.daeheekim.dev — 한국어 `/`, English `/en`

- 글 쓰기: 포스트별 폴더 `src/content/blog/<slug>/`에 `ko.md`·`en.md`, 이미지는 `<slug>/assets/` (`npm run post <slug> [life|dev]`로 생성)
  - frontmatter: `title`, `date`, `category`(`life` 개인 / `dev` 개발) 필수 / `description`, `draft: true`(숨김) 선택
  - 번역본이 없으면 언어 전환 링크는 해당 언어의 글 목록으로 이동
- 로컬 실행: `npm run dev` → http://localhost:4321
- 배포 결과 미리보기: `npm run build && npm run preview`
- 배포: `main`에 push하면 GitHub Actions가 GitHub Pages로 배포
- 브랜치: 배포본은 `main`, 글은 `post/<슬러그>`, 그 외 작업은 `chore/<작업>` 브랜치에서 (자세히는 `AGENTS.md`)
