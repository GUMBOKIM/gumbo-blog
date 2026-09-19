---
title: "My first week with Flutter"
description: "Dummy post for layout testing"
category: life
date: 2022-12-11
---

This is a dummy post for checking the layout. A short note on **my first week with flutter**.

## Background

It looked simple at first, but it took more work than expected. I read the docs, ran the examples, and eventually read the source to understand it.

## Solution

```ts
export async function run(input: string) {
  const result = await process(input);
  if (!result.ok) throw new Error(`Failed: ${result.reason}`);
  return result.value;
}
```

The key is that `process` returns failures as values instead of throwing.

- Treating errors as values makes the flow easier to read
- Retry logic lives in one place
- Tests get simpler

## Comparison

| Approach | Pros | Cons |
| --- | --- | --- |
| Exceptions | Shorter code | Harder to trace |
| Result values | Explicit | More verbose |

> There is no single right answer; pick what your team reads easily.

This paragraph exists to check how scrolling and line length look on a long post. How many characters fit on a line, whether the line height feels comfortable, and whether code blocks contrast well with the body text. The same sentences repeat to make the paragraph longer. How many characters fit on a line, whether the line height feels comfortable.

## Wrapping up

Next time I want to automate this whole process.
