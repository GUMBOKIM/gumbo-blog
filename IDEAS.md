# 다음에 할 것 / 아이디어

다른 컴퓨터에서도 이어서 하려고 저장소에 둔다. 끝난 건 지우고, 새 생각은 여기 적는다.

## 시리즈: 쓸데없는 걸 만들어서 올리기

AI로 뭔가 인터랙티브한 걸 브라우저에 만들고, 어떻게 구현했는지와 원리를 설명하는 글 시리즈.
전부 클라이언트 사이드, 서버 비용 0, 외부 API 없음이 원칙. 카테고리는 `useless`.
1번 플립닷은 `post/flip-dot`에서 끝냄(2026-10-31). 공용 엔진은 `src/components/flipdot/`에 있으니 다음 것도 같은 패턴(Astro 컴포넌트 + `astro:page-load`)으로.
블로그는 MDX + 바닐라 스크립트라 Astro 컴포넌트에 `<canvas>` + `<script>`로 넣으면 된다.
ClientRouter를 쓰므로 초기화는 `astro:page-load`에서 한다.

### 얼굴 사진 넣으면 STORM 춤추기 (다음 것)

배경: GENER8ION × Yung Lean "Storm" 뮤직비디오(2026-04, 감독 Romain Gavras)를 AI로 따라 만드는 유행.
Higgsfield Genjutsu 같은 영상→영상 모션 전이 도구로 만든 것이고 사진 한 장으로 되는 게 아님.
감독은 공개적으로 불평함 (https://stereogum.com/2515160/romain-gavras-addresses-slop-copies-of-gener8ion-yung-lean-storm-video/news).
비디오 디퓨전은 브라우저에서 불가능, 서버로 돌리면 건당 비용 + 인터랙티브 아님.

그래서 "의도적으로 구린 종이인형" 버전으로:
- 원본 영상에서 MediaPipe Pose로 안무 관절 좌표를 뽑아 JSON으로 저장(안무 동작 데이터는 저작권 대상 아님).
  영상 클립은 페이지에 넣지 않음.
- 사용자 사진은 MediaPipe 얼굴 분할로 브라우저에서 잘라내고, 2D 뼈대에 교복 몸통 그려서 얼굴을 붙임.
- 결과는 교복 입은 막대 인형이 내 얼굴 달고 춤추는 것. 구린 게 매력. 글에서 "왜 진짜 버전은 브라우저에서
  불가능한가"를 설명하는 재료.

설명할 원리: 포즈 추정이 뽑는 것, 관절 각도로 2D 리깅, 얼굴 분할, 진짜 모션 전이 모델과의 차이.

주의: 본인 사진 전제. 사진은 서버로 안 보내고 브라우저에서만 처리한다고 명시. 남의 얼굴 올리는 흐름 금지.

## 홍보 / SEO 밀린 것

- `macnotify`(ko/en)와 `five-years-of-a-side-project`가 아직 구글에 "URL is unknown". 크롤된 적 없음.
  Search Console → URL 검사 → 색인 요청을 직접 눌러야 함 (API로는 안 됨). 2026-10-28 기준.
- HN에 Show HN(50168384) 복구 요청 메일 보냄. 답장 왔는지 확인. 답 없으면 재게시 말고 댓글로 카르마부터.
- 방문자 현황(2026-10-28): 커뮤니티 올린 날만 하루 5~11명, 평소 0~2명. 검색 유입 거의 0.

## 운영 메모

- GA4/Search Console 토큰은 OAuth 동의 화면이 테스트 모드라 일주일마다 만료됨.
  gcloud 로그인이 만든 코드는 PKCE라 수동 교환 불가. Claude가 만든 동의 URL로 받아서 교환하는 게 빠름.
  (Claude 메모리 `ga4-analytics-mcp.md`에 절차 있음. 그 메모리는 각 컴퓨터별이니 없는 컴에서는 이 줄을 보고 요청.)
