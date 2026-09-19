# gumbo.log

https://blog.daeheekim.dev — 한국어 `/`, English `/en`

- 글 쓰기: `src/content/blog/ko/<slug>.md`와 `src/content/blog/en/<slug>.md`에 같은 파일명으로 작성 (한쪽만 쓰고 번역 요청)
  - frontmatter: `title`, `date`, `category`(`life` 개인 / `dev` 개발) 필수 / `description`, `draft: true`(숨김) 선택
  - 번역본이 없으면 언어 전환 링크는 해당 언어의 글 목록으로 이동
- 로컬 실행: `npm run dev` → http://localhost:4321
- 배포 결과 미리보기: `npm run build && npm run preview`
- 배포: `main`에 push하면 GitHub Actions가 GitHub Pages로 배포
