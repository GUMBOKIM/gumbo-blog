/**
 * Ownership checks for search engines. Paste the value from the "HTML tag" option:
 * Google   → Search Console → 소유권 확인 → HTML 태그 → content="..." 안의 값
 * Naver    → 서치어드바이저 → 사이트 등록 → HTML 태그 → content="..." 안의 값
 * Leave empty to omit the tag.
 *
 * Daum checks a comment line in robots.txt instead of a tag:
 * Daum     → 웹마스터도구 → 사이트 등록 → PIN 코드 (# 다음 부분 전체)
 */
export const GOOGLE_VERIFICATION = 'e0-xJBsyOGOPZELj6YGnzYnCXz79fMdagjsVSDEW49k';
export const NAVER_VERIFICATION = '2a433730d27778ec1b9b9e5b2b3f2fb391102ffe';
export const DAUM_VERIFICATION =
	'DaumWebMasterTool:d8d6d34bb09d37c529d72b7d60fc4120952658bb9dfcefd7bdb9e9ba407c5899:8eDCqJCqTZrYCvf1G9zNRA==';
