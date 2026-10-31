# 다음에 할 것 / 아이디어

다른 컴퓨터에서도 이어서 하려고 저장소에 둔다. 끝난 건 지우고, 새 생각은 여기 적는다.

## 시리즈: 쓸데없는 걸 만들어서 올리기

AI로 뭔가 인터랙티브한 걸 브라우저에 만들고, 어떻게 구현했는지와 원리를 설명하는 글 시리즈.
전부 클라이언트 사이드, 서버 비용 0, 외부 API 없음이 원칙. 카테고리는 `useless`.
1번 플립닷은 `post/flip-dot`에서 끝냄(2026-10-31). 공용 엔진은 `src/components/flipdot/`에 있으니 다음 것도 같은 패턴(Astro 컴포넌트 + `astro:page-load`)으로.
블로그는 MDX + 바닐라 스크립트라 Astro 컴포넌트에 `<canvas>` + `<script>`로 넣으면 된다.
ClientRouter를 쓰므로 초기화는 `astro:page-load`에서 한다.

2번 STORM 종이인형은 `post/storm-dance`에서 끝냄(2026-11-01, 발행일 11-02). 관절 추출 스크립트는 `scripts/storm-pose/`.
다음 아이템은 아직 없음.

## 홍보 / SEO 밀린 것

- `macnotify`(ko/en)와 `five-years-of-a-side-project`가 아직 구글에 "URL is unknown". 크롤된 적 없음.
  Search Console → URL 검사 → 색인 요청을 직접 눌러야 함 (API로는 안 됨). 2026-10-28 기준.
- HN에 Show HN(50168384) 복구 요청 메일 보냄. 답장 왔는지 확인. 답 없으면 재게시 말고 댓글로 카르마부터.
- 방문자 현황(2026-10-28): 커뮤니티 올린 날만 하루 5~11명, 평소 0~2명. 검색 유입 거의 0.

## 운영 메모

- GA4/Search Console 토큰은 OAuth 동의 화면이 테스트 모드라 일주일마다 만료됨.
  gcloud 로그인이 만든 코드는 PKCE라 수동 교환 불가. Claude가 만든 동의 URL로 받아서 교환하는 게 빠름.
  (Claude 메모리 `ga4-analytics-mcp.md`에 절차 있음. 그 메모리는 각 컴퓨터별이니 없는 컴에서는 이 줄을 보고 요청.)
