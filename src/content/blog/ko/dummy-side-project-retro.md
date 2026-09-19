---
title: "사이드 프로젝트 회고"
description: "레이아웃 확인용 더미 글"
category: life
date: 2026-05-30
---

이 글은 레이아웃 확인용 더미 글입니다. **사이드 프로젝트 회고**에 대해 짧게 정리합니다.

## 배경

처음에는 간단해 보였지만 막상 해 보니 생각보다 손이 많이 갔습니다. 문서를 읽고, 예제를 돌려 보고, 결국 직접 코드를 뜯어 보면서 이해했습니다.

## 해결

```ts
export async function run(input: string) {
  const result = await process(input);
  if (!result.ok) throw new Error(`실패: ${result.reason}`);
  return result.value;
}
```

핵심은 `process`가 실패를 예외 대신 값으로 돌려준다는 점입니다.

- 에러를 값으로 다루면 흐름이 읽기 쉬워진다
- 재시도 로직을 한곳에 모을 수 있다
- 테스트가 단순해진다

## 마무리

다음에는 이 과정을 자동화해 볼 생각입니다.
