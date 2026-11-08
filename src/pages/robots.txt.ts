import type { APIContext } from 'astro';
import { DAUM_VERIFICATION } from '../consts';

export function GET(context: APIContext) {
	const body = `User-agent: *
Allow: /

Sitemap: ${new URL('sitemap-index.xml', context.site)}
${DAUM_VERIFICATION ? `\n#${DAUM_VERIFICATION}\n` : ''}`;
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
