# gumbo blog

Astro 정적 블로그. 배포 주소는 https://blog.daeheekim.dev 이고, 저장소는 `GUMBOKIM/gumbo-blog`.
`main`에 push하면 GitHub Actions가 GitHub Pages로 배포한다.

## 글 쓰기

```bash
npm run post <slug> [life|dev]   # ko/en 두 파일을 한 번에 만든다
npm run dev                      # http://localhost:4321
```

- 글은 `src/content/blog/{ko,en}/<slug>.md`. 두 언어가 같은 파일명이면 언어 전환 링크가 서로 연결된다.
  번역본이 없으면 그 언어의 홈으로 보낸다.
- frontmatter: `title`, `date`, `category`(`life` 개인 / `dev` 개발) 필수. `description`, `draft: true` 선택.
- `date`를 미래로 적으면 예약 발행이다. 그 날짜 전에는 아예 빌드되지 않아 URL도 생기지 않고,
  Actions가 하루 한 번(한국 시간 09:10쯤) 다시 빌드하면서 때가 되면 올라온다. `npm run dev`에서는 미리 보인다.
  하루 한 번이라 시·분까지 맞추는 건 안 되고 날짜 단위로 생각하면 된다.
- 카테고리를 늘리려면 `src/categories.ts`에 추가하고, `src/i18n.ts`에 이름을 넣고,
  `src/pages/[...locale]/posts/<category>.astro`를 만든다.

## 사진

```bash
npm run photo <원본경로> [이름] [가로폭] [square]
```

- 휴대폰 사진에는 GPS가 들어 있으므로 **항상 EXIF를 지우고** 넣는다. 위 스크립트가 처리한다.
- 본인 외 다른 사람 얼굴은 스티커 등으로 가린다.
- 남의 사진(기사·업체 이미지)을 쓸 때는 캡션에 `출처:` 링크를 단다.
- 사진이 연달아 나오면 `<div class="gallery">`로 묶어 2열로 보여 준다. 세로 사진 3장은 `gallery portrait`.
- 사진을 누르면 원본이 크게 뜬다(lightbox). 로고(`.logo`)는 제외된다.

## 글 외 콘텐츠

- about 페이지 본문은 `src/content/about/{ko,en}.md`.
- 사이트 이름, 소개 문구, UI 문구는 `src/i18n.ts` 한 곳에 모여 있다.

## 디자인 규칙

- 다크 테마 전용. 색은 GitHub dark 팔레트이고 `src/styles/global.css`의 `:root` 변수로 관리한다.
- 폰트는 시스템 폰트만 쓴다. 한글 웹폰트는 파일이 100개 넘게 쪼개져 로딩이 버벅였다.
- 본문 폭은 `--max-width`(768px) 하나로 조절한다.
- 레이아웃이 흔들리지 않게 유지한다: 굵은 글씨 자리 미리 확보(`[data-label]`), `scrollbar-gutter: stable`.

## 브랜치

- `main` — 실제 배포본. 여기에 push하면 자동 배포된다. 직접 커밋하지 말고 아래 작업 브랜치에서 머지한다.
- `post/<슬러그>` — 글 하나를 쓰는 브랜치. 슬러그는 글 파일명과 맞춘다 (예: `post/hometax-open-redirect`).
- `chore/<작업>` — 글 외 작업(설정·스타일·버그픽스 등). (예: `chore/terminal-korean-glyph`)

브랜치 이름의 슬러그·작업 부분은 영문 케밥케이스로 쓴다. 한글·공백은 도구에 따라 깨진다.

## 배포

```bash
npm run build      # 확인용
git push           # main에 push하면 자동 배포
```

- 댓글은 giscus(저장소 Discussions, Announcements 카테고리)를 쓴다. 설정은 `src/components/Comments.astro`.
- RSS는 `/rss.xml`, 사이트맵은 `/sitemap-index.xml`, `robots.txt`도 자동 생성된다.
