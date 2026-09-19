---
title: "Adding a logger with decorators"
description: "Dummy post for layout testing"
category: dev
date: 2023-07-19
---

This is a dummy post for checking the layout. A short note on **adding a logger with decorators**.

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

## Wrapping up

Next time I want to automate this whole process.
