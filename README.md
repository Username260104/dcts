# Lens (DCTS)

애매한 디자인 피드백이나 전략 문서를 디자이너가 바로 쓸 수 있는 브리프로 정리해 주는 Next.js 기반 내부 도구입니다. 입력 역할에 따라 두 가지 흐름을 지원합니다.

- `client_feedback_interpretation`: 클라이언트의 모호한 피드백을 해석하고 디자인 방향 브리프로 변환
- `strategy_to_design_translation`: 전략/브랜드 문서를 디자인 실행용 번역 브리프로 변환

## 핵심 기능

### 1. 클라이언트 피드백 해석

- 짧은 한 줄 피드백, 메신저 문장, 수정 요청 문장을 그대로 입력할 수 있습니다.
- `PDF`, `DOCX`, `TXT`, `MD`, `JSON`, `CSV` 파일에서 텍스트를 추출해 바로 시작할 수 있습니다.
- 표현 다듬기 기능으로 원문을 더 명확한 문장으로 정리한 뒤 원문/정제문 중 하나를 선택해 진행할 수 있습니다.
- 업종, 가격대, 프로젝트 단계, 타깃 연령을 받아 질문 강도와 방향 후보를 조정합니다.
- 후속 질문을 통해 디자인 방향을 좁히고, 최종적으로 해석 브리프를 생성합니다.
- 브리프에는 방향 요약, 디자이너 해석, 디자인 토큰, 피해야 할 요소, 레퍼런스, 질문 흐름이 포함됩니다.

### 2. 전략에서 디자인으로 번역

- 전략가 입력 기준으로 포지셔닝, 브랜드 플랫폼, 브랜드 아키텍처, 경험 원칙, 캠페인/크리에이티브 브리프 시드, 아이덴티티 리프레시 범위를 다룹니다.
- 입력 문장에서 구조화된 전략 스키마를 추출하고, 누락/충돌/약한 항목을 찾아 추가 질문을 생성합니다.
- 전략 정합성이 충분하면 `translation_brief`를, 아직 구멍이 크면 `gap_memo`를 생성합니다.
- 생성 결과에는 전략 전제, 핵심 긴장, 디자인 함의, 추천/회피 방향, 의사결정 기준이 포함됩니다.

### 3. 결과 저장과 공유

- 생성된 브리프는 permalink 조회를 지원합니다.
- 브리프 화면과 permalink 화면 모두 PDF 다운로드를 지원합니다.
- 저장소가 따로 설정되지 않으면 로컬 `.runtime/briefs`에 JSON으로 저장합니다.
- Upstash Redis를 설정하면 brief 저장소를 원격으로 전환할 수 있습니다.

### 4. 안정성 장치

- 기본 LLM 호출이 실패하거나 타임아웃되면 일부 흐름은 결정론적 fallback으로 내려갑니다.
- 한국어 PDF 출력을 위해 `NotoSansKR` 폰트를 포함합니다.
- 파일 업로드는 최대 `10MB`, 추출 텍스트는 최대 `12,000`자까지만 반영합니다.

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Zustand
- Tailwind CSS 4
- Anthropic SDK / Gemini API
- `pdf-parse`, `mammoth`, `@napi-rs/canvas`
- `jspdf`

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 기준으로 `.env.local`을 만들고 필요한 값을 채웁니다.

```bash
copy .env.example .env.local
```

Windows가 아닌 환경이라면 `cp .env.example .env.local`을 사용하면 됩니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열면 됩니다.

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `LLM_PROVIDER` | `gemini` 또는 `anthropic`. 지정하지 않으면 `GEMINI_API_KEY` 존재 여부에 따라 공급자를 고릅니다. |
| `GEMINI_API_KEY` | Gemini 사용 시 API 키 |
| `GEMINI_MODEL` | Gemini 모델명. 기본값 `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | Anthropic 사용 시 API 키 |
| `ANTHROPIC_MODEL` | Anthropic 모델명. 기본값 `claude-sonnet-4-20250514` |
| `LLM_TIMEOUT_MS` | LLM 타임아웃 밀리초. 기본값 `15000` |
| `UPSTASH_REDIS_REST_URL` | brief 저장용 Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | brief 저장용 Upstash Redis REST 토큰 |
| `BRIEF_TTL_SECONDS` | Redis 사용 시 brief TTL 초 단위 설정 |

## 사용 흐름

### 클라이언트 피드백 해석

1. 역할을 `client`로 시작합니다.
2. 피드백 텍스트를 입력하거나 파일을 업로드합니다.
3. 필요하면 표현 다듬기를 실행합니다.
4. 프로젝트 맥락을 선택합니다.
5. 후속 질문에 답하며 방향을 좁힙니다.
6. 확인 후 해석 브리프를 생성하고 PDF 또는 permalink로 공유합니다.

### 전략 번역

1. 역할을 `strategist`로 시작합니다.
2. 전략 문장, 브랜드 설명, 포지셔닝 노트를 입력합니다.
3. 최소한 프로젝트 단계를 선택합니다.
4. 시스템이 전략 스키마를 추출하고 필요한 보강 질문을 이어서 묻습니다.
5. 준비도가 충분하면 번역 브리프를, 부족하면 갭 메모를 생성합니다.

## 주요 스크립트

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run strategy:fixtures
```

- `strategy:fixtures`는 전략 번역 fixture를 실행하는 내부 점검 스크립트입니다.

## API 개요

- `POST /api/session/start`: 세션 시작
- `POST /api/session/refine-feedback`: 입력 문장 다듬기
- `POST /api/session/extract-file`: 업로드 문서에서 텍스트 추출
- `POST /api/session/[id]/answer`: 질문 응답 처리
- `POST /api/session/[id]/refine`: 추가 질문 생성
- `POST /api/brief/[id]/generate`: 브리프 생성 및 저장
- `GET /api/brief/[id]`: 저장된 브리프 조회

## 디렉터리 구조

```text
src/
  app/
    api/                API 라우트
    brief/[id]/         permalink 페이지
  components/           단계별 UI와 브리프 렌더링
  data/                 방향 분기, 컨텍스트, 토큰 데이터
  lib/                  질문 엔진, LLM 오케스트레이션, 저장/내보내기 로직
  store/                Zustand 세션 상태
  types/                공통 타입
ai/                     제품/전략 문서 및 fixture 스크립트
public/                 폰트 및 정적 자산
```

## 개발 메모

- 로컬 brief 저장 파일은 `.runtime/briefs/<sessionId>.json` 형식입니다.
- `.runtime`은 런타임 산출물 디렉터리이므로 버전 관리 대상이 아닙니다.
- PDF 추출은 Node 런타임과 canvas polyfill에 의존합니다.
- 브리프 PDF는 브라우저에서 생성되며 `public/fonts/NotoSansKR-Variable.ttf`를 사용합니다.

## 현재 상태

- README는 현재 코드 기준으로 갱신되어 있습니다.
- 별도 테스트 문서는 없지만, 일반 개발 루틴은 `npm run lint`, `npm run build`, 필요 시 `npm run strategy:fixtures` 기준으로 보는 것이 안전합니다.
