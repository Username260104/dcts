# CONVENTIONS.md — DCTS 프로젝트 코딩 컨벤션

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 화면 1: 진입 화면
│   ├── session/[id]/
│   │   ├── context/page.tsx  # 화면 2: 맥락 입력
│   │   ├── page.tsx          # 화면 3: 질문 플로우
│   │   └── confirm/page.tsx  # 화면 4: 클라이언트 확인
│   └── brief/[id]/
│       └── page.tsx          # 화면 5: 브리프 출력
├── components/
│   ├── common/             # 공통 UI 컴포넌트
│   └── brief/              # 브리프 전용 컴포넌트
├── data/                   # 온톨로지 JSON 데이터
├── lib/                    # 핵심 비즈니스 로직
├── store/                  # Zustand 상태 관리
└── types/                  # TypeScript 타입 정의
```

## 상수 파일

모든 매직 넘버와 설정값은 `src/lib/constants.ts`에 정의한다.

## 스타일링

- Tailwind CSS 유틸리티 클래스를 사용한다.
- 컴포넌트별 CSS 파일은 만들지 않는다.
- 반응형: 모바일 퍼스트 (`sm:`, `md:`, `lg:` 순서).
- 색상 팔레트: 뉴트럴 중심. 강조색은 `blue-600` 계열 1개.

## 컴포넌트 작성

- 함수형 컴포넌트 + `'use client'` 디렉티브 (클라이언트 상태 사용 시).
- Props 인터페이스는 컴포넌트 파일 상단에 정의한다.
- 컴포넌트 파일명: PascalCase (`ProgressBar.tsx`).
- 유틸/로직 파일명: camelCase (`triggerMatcher.ts`).

## 데이터 파일

- `src/data/*.json` 파일은 빌드 타임 static import로 사용한다.
- 런타임 API 호출 없이 JSON 직접 참조.
