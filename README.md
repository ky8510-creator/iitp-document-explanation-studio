# IITP 문서 설명자료 스튜디오

Kordoc으로 HWPX를 파싱하고, 원문 출처와 미결정 사항을 보존한 편집 가능한 한국어 설명자료를 만든 뒤 native HWPX로 내려받는 Node 웹 앱입니다. 각 워크플로는 기존 `문서 업로드` 모드와 공개 웹·선택 HWPX를 함께 쓰는 `기술동향 분석` 모드를 제공합니다.

## 지원 워크플로

- A — 기술수요조사서 HWPX + 기술기획보고서 HWPX → 사업설명자료
- B — RFP HWPX + 연구개발계획서 HWPX(선택) → 과제설명자료

두 워크플로 탭 안에서 다음 모드를 독립적으로 사용할 수 있습니다.

- `문서 업로드` — 기존 역할별 HWPX 업로드, Kordoc 검토, 설명자료 생성 흐름
- `기술동향 분석` — ICT 분야와 자유 키워드를 입력하고, Google News RSS 실시간 근거와 선택한 동향/기획 HWPX 근거를 분리 분석한 뒤 현재 워크플로의 설명자료 생성

기술동향 분석은 AI/인공지능, 반도체, 클라우드, 사이버보안, 양자정보통신, 6G/네트워크, 로봇/스마트제조, 데이터/소프트웨어 및 기타 ICT 분야를 지원합니다. 선택 HWPX는 기존 `/api/parse`와 Kordoc 경로를 그대로 사용합니다. 사업/과제 탭과 모드별 입력·분석 상태는 서로 분리되어 탭을 오가도 유지됩니다.

## 출력 섹션 선택

사업설명자료와 과제설명자료 모두 `문서 업로드` 및 `기술동향 분석` 모드에서 출력 섹션을 선택할 수 있습니다. 기본값은 추진배경, 사업개요, 사업목표, 상세 추진내용, 관련 주요 정책 및 국정과제, 예산현황, 주요성과 전체 선택입니다. `기타 입력`은 내용이 있을 때 사용자 입력/검토 메모로 포함되며, 검증된 출처 사실과 명확히 구분됩니다. 사업/과제 워크플로의 선택 상태는 서로 독립적이고, 같은 워크플로 안에서는 업로드/기술동향 모드를 바꿔도 유지됩니다. 모든 항목이 해제되고 기타 입력도 비어 있으면 프론트엔드와 API 모두 생성을 거부합니다.

과제설명자료는 공통 선택 항목을 RFP 문맥에 맞게 다음처럼 표시합니다.

| 공통 선택 항목 | 과제설명자료 제목 |
| --- | --- |
| 추진배경 | 현황 및 지원 필요성 |
| 사업개요 | 과제 개요 |
| 사업목표 | 해결해야 할 문제와 목표 |
| 상세 추진내용 | 주요 개발내용과 필수 요구사항 |
| 관련 주요 정책 및 국정과제 | 정책·국정과제 연계 |
| 예산현황 | 기간·예산·추진체계 |
| 주요성과 | 성과지표·시험 및 완료판정/기대효과 |
| 기타 입력 | 사용자 입력/검토 메모 |

두 흐름 모두 업로드 확장자·크기·ZIP 시그니처를 확인하고 Kordoc 추출 결과, 파일 SHA-256, 표 행·목차·페이지 메타데이터를 보여줍니다. 생성 결과는 Markdown 편집기에서 수정할 수 있습니다. 다운로드 요청 때 현재 편집본을 `markdownToHwpx()`로 변환하고 `validateHwpx()` 및 HWPX 재추출을 통과한 파일만 반환합니다.

생성기는 특정 기술명을 하드코딩하지 않습니다. 사업설명자료 HWP 참고본은 `/opt/data/skills/research/iitp-business-explanation-materials`에 기록된 공통 목차·문체·표 원칙만 적용합니다. 참고본의 기술 사실, 기관, 기간, 예산, 수치는 생성 컨텍스트에 넣지 않습니다.

## 공개 웹 근거와 한계

- 서버는 사용자 입력 URL을 가져오지 않습니다. 분야별 검색어와 사용자의 주제 키워드로 서버가 구성한 고정 `https://news.google.com/rss/search` 주소만 호출합니다.
- 수집에는 8초 제한을 적용합니다. RSS 장애·차단·빈 결과는 `error` 또는 `unavailable` 상태, 오류 메시지, 수집 시각과 함께 반환합니다. 이 경우에도 근거 필요 항목이 표시된 분석 틀과 설명자료 초안을 만들 수 있습니다.
- RSS 제목·발행일·짧은 설명·URL은 발견 근거입니다. 연결된 기사 원문 전체를 읽거나 진위를 독립 검증했다는 뜻이 아닙니다.
- 분야별 과기정통부, IITP, NIA, KISA, ETRI 링크는 공식 원문 추가 확인용 고정 링크입니다. 해당 페이지 본문은 자동 수집하지 않으며 기술 사실의 근거로 간주하지 않습니다.
- 동향 기반 설명자료는 사용한 URL을 보존하고, 정책·예산·기간·KPI·TRL·기관·실증/배포 대상·정량값을 근거 없이 생성하지 않습니다. 미지원 값은 `[추가 조사 필요]` 또는 `[담당자 확인 필요]`로 표시합니다.

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
- `POST /api/generate/business` — 파싱된 `demand`, `planning`, 선택 `sections`, `customText` JSON
- `POST /api/generate/task` — 파싱된 필수 `rfp`, 선택 `researchPlan`, `sections`, `customText` JSON
- `POST /api/trends/analyze` — `field`, `topic`, 선택 `sourceDocument` JSON; RSS/공식 확인 링크, 상태, 분석 Markdown, 미해결 항목 반환
- `POST /api/generate/business-trend` — `analysis`, 선택 `sections`, `customText` JSON → 근거 표시 사업설명자료
- `POST /api/generate/task-trend` — `analysis`, 선택 `sections`, `customText` JSON → 근거 표시 과제설명자료
- `POST /api/export` — 편집된 `markdown`, `filename` JSON; 검증된 HWPX 응답
- `GET /api/health` — 상태 확인

API는 사용자 문서를 전역 세션에 저장하지 않는 stateless 구조입니다. 테스트는 RSS fixture와 주입한 fetch 함수를 사용하므로 실시간 네트워크에 의존하지 않습니다. 현재 버전의 호환성 검증은 Kordoc 구조 검사와 round-trip 추출이며, 한컴오피스 GUI 열기 검증을 의미하지 않습니다.
