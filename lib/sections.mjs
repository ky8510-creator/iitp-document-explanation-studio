export const SECTION_KEYS = Object.freeze([
  'background', 'overview', 'goal', 'details', 'policy', 'budget', 'performance', 'custom'
]);

export const STANDARD_SECTION_KEYS = Object.freeze(SECTION_KEYS.filter(key => key !== 'custom'));

export const DEFAULT_SECTIONS = Object.freeze(Object.fromEntries(
  SECTION_KEYS.map(key => [key, key !== 'custom'])
));

export function resolveSections(sections, customText = '') {
  const normalizedText = String(customText ?? '').trim().slice(0, 20_000);
  const normalized = sections == null
    ? { ...DEFAULT_SECTIONS }
    : Object.fromEntries(SECTION_KEYS.map(key => [key, sections[key] === true]));
  if (normalizedText) normalized.custom = true;
  if (!SECTION_KEYS.some(key => normalized[key]) && !normalizedText) {
    throw Object.assign(new Error('출력할 섹션을 하나 이상 선택하거나 기타 입력을 작성해주세요.'), { status: 400 });
  }
  return { sections: normalized, customText: normalizedText };
}

export function selectedStandardKeys(sections) {
  return STANDARD_SECTION_KEYS.filter(key => sections[key]);
}
