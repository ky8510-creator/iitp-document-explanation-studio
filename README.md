# IITP 문서 설명자료 스튜디오

Kordoc으로 HWPX를 파싱하고, 원문 출처와 미결정 사항을 보존한 편집 가능한 한국어 설명자료를 만든 뒤 native HWPX로 내려받는 Node 웹 앱입니다.

## 지원 워크플로

- A — 기술수요조사서 HWPX + 기술기획보고서 HWPX → 사업설명자료
- B — RFP HWPX + 연구개발계획서 HWPX(선택) → 과제설명자료

두 흐름 모두 업로드 확장자·크기·ZIP 시그니처를 확인하고 Kordoc 추출 결과, 파일 SHA-256, 표 행·목차·페이지 메타데이터를 보여줍니다. 생성 결과는 Markdown 편집기에서 수정할 수 있습니다. 다운로드 요청 때 현재 편집본을 `markdownToHwpx()`로 변환하고 `validateHwpx()` 및 HWPX 재추출을 통과한 파일만 반환합니다.

생성기는 특정 기술명을 하드코딩하지 않습니다. 사업설명자료 HWP 참고본은 `/opt/data/skills/research/iitp-business-explanation-materials`에 기록된 공통 목차·문체·표 원칙만 적용합니다. 참고본의 기술 사실, 기관, 기간, 예산, 수치는 생성 컨텍스트에 넣지 않습니다.

## 요구 환경

- Node.js 20 이상
- 테스트·E2E 실행 시 사용자 요청에 명시된 `/opt/data/IITP/...` 샘플 파일

## 설치 및 실행

```bash
cd /opt/data/IITP/iitp-document-app
npm install
npm run check
npm test
npm run e2e
npm start
```

브라우저에서 `http://localhost:3000`을 엽니다. 포트를 바꾸려면 `PORT=3100 npm start`처럼 실행합니다.

## 검증 명령

```bash
# JavaScript 구문 검사
npm run check

# 두 워크플로 단위·통합 테스트와 Kordoc HWPX 검증
npm test

# 요청된 세 샘플을 이용한 두 전체 흐름 및 형식 참고 HWP 파싱
npm run e2e
```

E2E 산출물은 `tmp/e2e/`에 생성됩니다. 이 디렉터리는 검증용 임시 산출물이므로 Git에 포함하지 않습니다.

## API 요약

- `POST /api/parse` — raw HWPX body, `X-Filename`, `X-Document-Role` 헤더
- `POST /api/generate/business` — 파싱된 `demand`, `planning` JSON
- `POST /api/generate/task` — 파싱된 필수 `rfp`, 선택 `researchPlan` JSON
- `POST /api/export` — 편집된 `markdown`, `filename` JSON; 검증된 HWPX 응답
- `GET /api/health` — 상태 확인

API는 사용자 문서를 전역 세션에 저장하지 않는 stateless 구조입니다. 현재 버전의 호환성 검증은 Kordoc 구조 검사와 round-trip 추출이며, 한컴오피스 GUI 열기 검증을 의미하지 않습니다.
