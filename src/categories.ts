/** Post categories; each needs a page at src/pages/[...locale]/posts/<category>.astro */
export const CATEGORIES = ['life', 'dev', 'useless'] as const;
export type Category = (typeof CATEGORIES)[number];
