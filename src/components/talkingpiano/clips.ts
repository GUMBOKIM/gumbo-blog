/**
 * The famous lines. Only their keygrams (grams.json) ship with the blog; the audio stays out.
 * `words` are the subtitle pieces and when each one starts, in seconds from the start of the keygram.
 * `source` is where the audio came from; `trim` is the cut inside that video, used by the prep script.
 */
export interface Clip {
	id: string;
	who: { ko: string; en: string };
	/** Subtitle in the language that is spoken */
	words: [number, string][];
	/** Translation shown under it, when the line isn't in the reader's language */
	gloss: { ko?: string; en?: string };
	source: string;
	trim: [number, number];
}

export const CLIPS: Clip[] = [
	{
		id: 'zoro',
		who: { ko: '조로 · 원피스', en: 'Zoro · One Piece' },
		words: [
			[0.2, '何も'],
			[2.1, '…なかった'],
		],
		gloss: { ko: '아무 일도… 없었다', en: 'Nothing… happened.' },
		source: 'https://www.youtube.com/watch?v=8otNP2cdu8c&t=22',
		trim: [22.15, 25.3],
	},
	{
		id: 'tazza',
		who: { ko: '곽철용 · 타짜', en: 'Kwak Cheol-yong · Tazza: The High Rollers' },
		words: [
			[0.2, '묻고'],
			[0.45, '더블로'],
			[0.75, '가!'],
		],
		gloss: { en: 'Let it ride. Double it!' },
		source: 'https://www.youtube.com/watch?v=XsM-QWpDgBg&t=19',
		trim: [19.65, 21.05],
	},
	{
		id: 'veteran',
		who: { ko: '조태오 · 베테랑', en: 'Jo Tae-oh · Veteran' },
		words: [
			[0.2, '어이가'],
			[0.6, '없네'],
		],
		gloss: { en: 'Unbelievable.' },
		source: 'https://www.youtube.com/watch?v=zASuuYQFht4&t=97',
		trim: [97.35, 98.85],
	},
	{
		id: 'insiders',
		who: { ko: '안상구 · 내부자들', en: 'Ahn Sang-goo · Inside Men' },
		words: [
			[0.2, '모히또'],
			[0.65, '가가지고'],
			[1.0, '몰디브나'],
			[1.6, '한 잔'],
			[1.8, '할라니까'],
		],
		gloss: { en: 'Gonna go to Mojito and have a Maldives. (He means the other way round.)' },
		source: 'https://www.youtube.com/watch?v=OKr3Ay1tPHo&t=19',
		trim: [19.35, 21.45],
	},
];
