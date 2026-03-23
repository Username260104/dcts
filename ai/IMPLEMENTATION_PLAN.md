# DCTS 3-Layer Communication 구현 계획

## 개요

DCTS를 "클라이언트 ↔ 전략 ↔ 디자이너" 3자 소통 도구로 전환한다.
핵심 변경: 온톨로지에 전략 언어 추가, 진입점에서 역할 분기, Brief 3-레이어 출력, ContextStep 모드별 분기.

---

## Phase 1: 타입 시스템 확장

### 1-1. `src/types/ontology.ts` 수정

**SessionStep 확장** (line 109)
```ts
// 변경 전
export type SessionStep = 'entry' | 'context' | 'questions' | 'confirm' | 'brief';

// 변경 후
export type SessionStep = 'role' | 'entry' | 'context' | 'questions' | 'confirm' | 'brief';
```

**InputRole 타입 추가** (line 1 부근, 새 타입)
```ts
export type InputRole = 'client' | 'strategist';
```

**Branch 인터페이스 확장** (line 14-26)
```ts
// 기존 필드 유지, 아래 3개 추가
export interface Branch {
    // ... 기존 필드 ...
    descriptionStrategy: string;      // 전략적 해석
    positioningContext: string;        // 브랜드 포지셔닝 맥락
    competitiveImplication: string;    // 경쟁 맥락에서의 의미
}
```

**UserContext 인터페이스 확장** (line 102-107)
```ts
// 변경 전
export interface UserContext {
    industry: string;
    pricePosition: string;
    projectStage: string;
    targetAge?: string;
}

// 변경 후
export interface UserContext {
    industry: string;
    pricePosition: string;
    projectStage: string;
    targetAge?: string;
    // strategist 모드 전용 자유입력 필드
    brandDescription?: string;     // 브랜드/클라이언트 설명
    positioningNote?: string;      // 포지셔닝 한 줄 설명
    additionalContext?: string;    // 특이사항
}
```

**SessionState 인터페이스 확장** (line 170-188)
```ts
export interface SessionState {
    // ... 기존 필드 유지 ...
    inputRole: InputRole;  // 추가
}
```

**BriefOutput 인터페이스 확장** (line 111-128)
```ts
export interface BriefOutput {
    // ... 기존 필드 유지 ...
    inputRole: InputRole;                 // 추가
    strategySummary: string;              // 추가: 전략 해석 요약
    strategyPositioningContext: string;   // 추가: 포지셔닝 맥락
    strategyPersuasionGuide: string;      // 추가: 클라이언트 설득 포인트
}
```

**LLMBriefResponse 인터페이스 확장** (line 162-168)
```ts
export interface LLMBriefResponse {
    // ... 기존 필드 유지 ...
    strategySummary: string;              // 추가
    strategyPositioningContext: string;   // 추가
    strategyPersuasionGuide: string;      // 추가
}
```

**StartSessionRequest 확장** (line 211-214)
```ts
export interface StartSessionRequest {
    feedbackText: string;
    context: UserContext;
    inputRole: InputRole;  // 추가
}
```

---

## Phase 2: 데이터 확장

### 2-1. `src/data/branches.json` 수정

36개 브랜치 각각에 3개 필드 추가. 예시 (LUX-B):

```json
{
    "branchId": "LUX-B",
    "branchLabel": "미니멀 럭셔리",
    "descriptionDesigner": "절제된 고급감, Less is More, 조용한 사치. 여백 자체가 가치",
    "descriptionClient": "비싼 호텔 로비처럼, 아무것도 없는데 고급스러운 느낌",
    "descriptionStrategy": "절제를 통한 프리미엄 포지셔닝. 타깃이 과시보다 자기만족형 소비를 선호하는 세그먼트일 때 유효. 정보를 줄여 perceived value를 높이는 전략",
    "positioningContext": "프리미엄~럭셔리 브랜드 중 '조용한 사치(quiet luxury)' 트렌드에 부합. 2030 고소득층, 4050 자기보상 소비층에 효과적",
    "competitiveImplication": "경쟁사가 정보 과잉 또는 장식 과잉일 때, 여백으로 차별화. Apple, Aesop 계열 포지셔닝과 유사",
    ...기존 필드 유지
}
```

> 36개 브랜치 전체에 대해 descriptionStrategy, positioningContext, competitiveImplication을 작성해야 함.
> 기존 필드(descriptionClient, descriptionDesigner 등)는 일체 변경 없음.

### 2-2. `src/data/briefTemplate.json` 수정

B와 C 섹션 사이에 전략 섹션 삽입. 기존 C → D로, D → E로 밀림.

```json
[
    { "section": "A. 원문 피드백", ... },
    { "section": "B. 해석 요약 (클라이언트 확인용)", ... },
    {
        "section": "C. 전략 해석",
        "item": "포지셔닝 맥락",
        "example": "대중 통신 브랜드의 영타깃 캠페인에서 '프리미엄'은 가격이 아니라 감성 품질. 경쟁사 대비 '친근하지만 세련된' 틈새.",
        "guide": "왜 이 방향이 브랜드 전략에 부합하는지. AE가 클라이언트에게 설명할 근거."
    },
    {
        "section": "C. 전략 해석",
        "item": "클라이언트 설득 포인트",
        "example": "'싸 보일까 걱정'에 대해 → '친근함 ≠ 저가. NAT-B는 자연스러운 소재감과 여백으로 품질을 표현합니다'",
        "guide": "클라이언트가 가질 수 있는 우려에 대한 대응 논리."
    },
    { "section": "D. 해석 요약 (디자이너용)", ... },
    { "section": "E. 디자인 조정 힌트", ... },
    { "section": "F. 하지 말아야 할 것", ... },
    { "section": "G. 레퍼런스 방향", ... },
    { "section": "H. 선택 흐름 설명", ... }
]
```

---

## Phase 3: Store 확장

### 3-1. `src/store/sessionStore.ts` 수정

**SessionStore 인터페이스에 추가** (line 21-65 부근)
```ts
interface SessionStore {
    // ... 기존 필드 유지 ...
    inputRole: InputRole;                              // 추가
    setInputRole: (role: InputRole) => void;            // 추가
}
```

**초기값에 추가** (line 83-99 부근)
```ts
export const useSessionStore = create<SessionStore>((set, get) => ({
    // ... 기존 초기값 유지 ...
    inputRole: 'client',  // 추가 (기본값)

    setInputRole: (inputRole) => set({ inputRole }),  // 추가
```

**startSession 수정** (line 157-198)
- `body`에 `inputRole` 포함하여 전송
```ts
startSession: async () => {
    const { feedbackText, refinedFeedbackText, refineChoice, userContext, inputRole } = get();
    // ...
    body: JSON.stringify({
        feedbackText: selectedFeedbackText,
        context: userContext,
        inputRole,          // 추가
    }),
```

**reset 수정** (line 337-354)
```ts
reset: () => set({
    // ... 기존 필드 유지 ...
    inputRole: 'client',  // 추가
    step: 'role',          // 'entry' → 'role'로 변경
}),
```

**resetToContext 수정** (line 356-369)
- 변경 없음 (context 단계로 돌아가므로 inputRole 유지)

---

## Phase 4: 컴포넌트 수정/생성

### 4-1. 새 파일: `src/components/steps/RoleStep.tsx`

역할 선택 화면. 세션 시작 전 첫 번째 화면.

```tsx
'use client';

import { useSessionStore } from '@/store/sessionStore';
import type { InputRole } from '@/types/ontology';

export default function RoleStep() {
    const setInputRole = useSessionStore((state) => state.setInputRole);
    const setStep = useSessionStore((state) => state.setStep);

    const handleSelect = (role: InputRole) => {
        setInputRole(role);
        setStep('entry');
    };

    return (
        <div className="flex w-full max-w-lg flex-col items-center px-4 py-8">
            <div className="mb-8 text-center">
                <h2 className="mb-2 text-xl font-bold text-gray-900">
                    어떻게 시작할까요?
                </h2>
                <p className="text-sm text-gray-500">
                    입력하는 내용에 따라 질문 방식이 달라집니다.
                </p>
            </div>

            <div className="w-full space-y-3">
                <button
                    onClick={() => handleSelect('client')}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left
                               transition-all hover:border-gray-400 hover:shadow-md"
                >
                    <p className="text-base font-medium text-gray-900">
                        클라이언트 피드백을 옮기기
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        클라이언트가 한 말을 그대로 입력합니다.
                        미팅 메모, 메신저 내용 등을 붙여넣으세요.
                    </p>
                </button>

                <button
                    onClick={() => handleSelect('strategist')}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-left
                               transition-all hover:border-gray-400 hover:shadow-md"
                >
                    <p className="text-base font-medium text-gray-900">
                        내가 해석한 방향을 입력하기
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        브랜드 포지셔닝, 원하는 방향을 직접 서술합니다.
                        팀 내부 언어 정렬에 유용합니다.
                    </p>
                </button>
            </div>
        </div>
    );
}
```

### 4-2. `src/components/StepContainer.tsx` 수정 (line 10-27)

```tsx
import RoleStep from './steps/RoleStep';
// ... 기존 import 유지

export default function StepContainer() {
    const step = useSessionStore((s) => s.step);

    switch (step) {
        case 'role':           // 추가
            return <RoleStep />;
        case 'entry':
            return <EntryStep />;
        // ... 나머지 동일
    }
}
```

### 4-3. `src/components/ProgressBar.tsx` 수정 (line 6-12)

```ts
const steps: { key: SessionStep; label: string }[] = [
    { key: 'role', label: '시작' },     // 추가
    { key: 'entry', label: '피드백' },
    { key: 'context', label: '맥락' },
    { key: 'questions', label: '질문' },
    { key: 'confirm', label: '확인' },
    { key: 'brief', label: '브리프' },
];
```

### 4-4. `src/components/steps/EntryStep.tsx` 수정

**제목 텍스트를 역할에 따라 분기** (line 46-52 부근)

```tsx
export default function EntryStep() {
    const inputRole = useSessionStore((state) => state.inputRole);
    // ... 기존 hooks 유지 ...

    const titleText = inputRole === 'strategist'
        ? '방향을 자유롭게 설명해 주세요.'
        : '피드백을 자연스럽게 적어 주세요.';

    const placeholderText = inputRole === 'strategist'
        ? '브랜드 포지셔닝, 원하는 방향, 경쟁 맥락 등을 자유롭게 서술하세요.'
        : '피드백을 입력해 주세요.';
```

**"이전" 버튼이 role 단계로 돌아가도록** — 현재 EntryStep에는 이전 버튼 없음.
하단 화살표 버튼 옆에 "역할 변경" 링크 추가 (선택 사항):

```tsx
// line 72 부근, 화살표 버튼 div 내부에 추가
<button
    type="button"
    onClick={() => setStep('role')}
    className="text-xs text-gray-400 hover:text-gray-600"
>
    역할 변경
</button>
```

**자주 쓰는 표현 섹션 — strategist 모드에서 숨김** (line 145-163)

```tsx
{inputRole === 'client' && (
    <div className="mb-8 w-full max-w-3xl">
        <p className="mb-3 text-center text-xs text-gray-400">자주 쓰는 표현</p>
        {/* ... 기존 frequentTriggers 버튼 ... */}
    </div>
)}
```

### 4-5. `src/components/steps/ContextStep.tsx` 수정

inputRole에 따라 객관식 vs 자유입력을 분기.

**strategist 모드 UI 추가:**

```tsx
export default function ContextStep() {
    const inputRole = useSessionStore((state) => state.inputRole);
    // ... 기존 hooks 유지 ...

    // strategist 모드: 자유입력 필드
    if (inputRole === 'strategist') {
        return (
            <div className="flex flex-col items-center px-4 py-8">
                <div className="mb-8 text-center">
                    <h2 className="mb-1 text-xl font-bold text-gray-900">프로젝트 맥락</h2>
                    <p className="text-sm text-gray-500">
                        브랜드와 프로젝트에 대해 자유롭게 설명해 주세요.
                    </p>
                </div>

                <div className="w-full max-w-lg space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            브랜드/클라이언트
                        </label>
                        <input
                            type="text"
                            value={userContext.brandDescription ?? ''}
                            onChange={(e) => setUserContext({ brandDescription: e.target.value })}
                            placeholder="예: LG U+ 브랜드 리뉴얼"
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm ..."
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            포지셔닝/성격
                        </label>
                        <textarea
                            value={userContext.positioningNote ?? ''}
                            onChange={(e) => setUserContext({ positioningNote: e.target.value })}
                            placeholder="예: 통신사 중 영타깃 서브브랜드, 대중 브랜드인데 프리미엄 감성"
                            rows={2}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm ..."
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            작업 단계
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(ctxData.projectStage).map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setUserContext({ projectStage: option })}
                                    className={`rounded-lg border px-4 py-2 text-sm ...`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            기타 특이사항 (선택)
                        </label>
                        <textarea
                            value={userContext.additionalContext ?? ''}
                            onChange={(e) => setUserContext({ additionalContext: e.target.value })}
                            placeholder="예: 경쟁사 SKT가 테크감, KT가 안정감이라 차별화 필요"
                            rows={2}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm ..."
                        />
                    </div>
                </div>

                {/* 버튼 영역: 이전/질문 시작 — 기존 동일 구조 */}
                {/* isComplete 조건 변경: */}
            </div>
        );
    }

    // client 모드: 기존 객관식 UI 그대로 유지
    // ...기존 return문 동일...
}
```

**client 모드 isComplete 조건** (line 68-72) — 변경 없음.

**strategist 모드 isComplete 조건:**
```ts
const isCompleteStrategist = Boolean(
    userContext.projectStage
    // brandDescription, positioningNote는 선택 — 빈 값이어도 진행 가능
);
```

### 4-6. `src/components/steps/BriefStep.tsx` 수정

기존 섹션 B(클라이언트)와 C(디자이너) 사이에 **전략 해석 섹션** 삽입.

**섹션 순서 변경:**

```
A. 원문 피드백          (변경 없음)
B. 클라이언트 확인용     (변경 없음)
C. 전략 해석            (신규)
D. 디자이너용 해석       (기존 C → D로 이름 변경)
E. 디자인 조정 힌트      (기존 D → E로 이름 변경)
F. 하지 말아야 할 것     (기존 E → F)
G. 레퍼런스 방향         (기존 F → G)
H. 선택 흐름 설명        (기존 G → H)
```

**C. 전략 해석 섹션 코드** (기존 C 섹션 앞에 삽입):

```tsx
<Section title="C. 전략 해석">
    <div className="space-y-3">
        {brief.strategySummary && (
            <div>
                <p className="mb-1 text-xs font-medium text-gray-500">방향 요약</p>
                <p className="text-sm leading-relaxed text-gray-800">
                    {brief.strategySummary}
                </p>
            </div>
        )}

        {brief.strategyPositioningContext && (
            <div className="rounded-lg bg-purple-50 p-3">
                <p className="mb-1 text-xs font-medium text-purple-600">
                    포지셔닝 맥락
                </p>
                <p className="text-sm text-purple-800">
                    {brief.strategyPositioningContext}
                </p>
            </div>
        )}

        {brief.strategyPersuasionGuide && (
            <div className="rounded-lg bg-indigo-50 p-3">
                <p className="mb-1 text-xs font-medium text-indigo-600">
                    클라이언트 설득 포인트
                </p>
                <p className="text-sm text-indigo-800">
                    {brief.strategyPersuasionGuide}
                </p>
            </div>
        )}
    </div>
</Section>
```

### 4-7. `src/components/steps/ConfirmStep.tsx` 수정

**전략 해석 미리보기 추가** — primaryBranch 카드 아래, reasoning 위에:

```tsx
{primaryBranch?.descriptionStrategy && (
    <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
        <p className="mb-1 text-xs font-medium text-purple-600">전략 해석</p>
        <p className="text-sm leading-relaxed text-purple-800">
            {primaryBranch.descriptionStrategy}
        </p>
    </div>
)}
```

---

## Phase 5: API 수정

### 5-1. `src/app/api/session/start/route.ts` 수정

**inputRole 수신 및 SessionState에 저장** (line 20-92)

```ts
const body: StartSessionRequest = await request.json();
// ...
const sessionState: SessionState = {
    // ... 기존 필드 유지 ...
    inputRole: body.inputRole ?? 'client',  // 추가
};
```

**strategist 모드 시스템 프롬프트 분기:**
LLM 호출 시 `analyzeInitialFeedback`에 `inputRole`을 전달하여 프롬프트 조정.

```ts
// strategist 모드일 경우 context 자유입력 내용을 피드백과 함께 전달
const feedbackForAnalysis = body.inputRole === 'strategist'
    ? buildStrategistInput(body.feedbackText, body.context)
    : body.feedbackText;

analysis = await analyzeInitialFeedback(
    feedbackForAnalysis,
    body.context,
    body.inputRole ?? 'client'
);
```

헬퍼 함수:
```ts
function buildStrategistInput(feedbackText: string, context: UserContext): string {
    const parts = [feedbackText];
    if (context.brandDescription) parts.push(`브랜드: ${context.brandDescription}`);
    if (context.positioningNote) parts.push(`포지셔닝: ${context.positioningNote}`);
    if (context.additionalContext) parts.push(`특이사항: ${context.additionalContext}`);
    return parts.join('\n');
}
```

### 5-2. `src/lib/llmOrchestrator.ts` 수정

**`analyzeInitialFeedback` 시그니처 확장** (line 305-367)

```ts
export async function analyzeInitialFeedback(
    feedbackText: string,
    userContext: UserContext,
    inputRole: InputRole = 'client'   // 추가
): Promise<LLMInitialAnalysis> {
```

**inputRole에 따른 시스템 프롬프트 분기:**

```ts
const roleInstruction = inputRole === 'strategist'
    ? `The input comes from a strategist/AE, not a client.
       The language is more structured and may include positioning terms.
       Treat the input as a professional interpretation, not raw feedback.
       You can narrow candidates more aggressively since the input is more precise.`
    : `The input comes from raw client feedback.
       The language is vague and emotional.
       Ask questions in plain Korean suitable for non-designers.`;

const systemPrompt = `${BASE_SYSTEM_PROMPT}

${roleInstruction}

Ontology branches:
${compressBranches()}

Context weighting:
${inputRole === 'strategist' ? buildFreeformContextPrompt(userContext) : compressContext(userContext)}`;
```

**자유입력 컨텍스트 처리 함수 추가:**

```ts
function buildFreeformContextPrompt(userContext: UserContext): string {
    const parts: string[] = [];

    if (userContext.brandDescription) {
        parts.push(`Brand: ${userContext.brandDescription}`);
    }
    if (userContext.positioningNote) {
        parts.push(`Positioning: ${userContext.positioningNote}`);
    }
    if (userContext.additionalContext) {
        parts.push(`Additional context: ${userContext.additionalContext}`);
    }

    // projectStage는 정형 데이터이므로 기존 방식으로 처리
    if (userContext.projectStage && ctxData.projectStage[userContext.projectStage]) {
        const option = ctxData.projectStage[userContext.projectStage];
        parts.push(`Project stage: ${userContext.projectStage} (boost: ${option.boost.join(',')}, suppress: ${option.suppress.join(',')})`);
    }

    if (parts.length === 0) {
        return compressContext(userContext);
    }

    return `Freeform context from strategist:\n${parts.join('\n')}\n\nUse this context to infer which branches to boost/suppress. Do not require exact category matches.`;
}
```

**`generateBriefSummary` 수정** (line 615-688)

시스템 프롬프트에 전략 레이어 출력 요구 추가:

```ts
const systemPrompt = `You are generating a final DCTS brief summary.

Return JSON only.
- clientSummary: plain Korean, 2-3 sentences. For client confirmation.
- clientAntiSummary: plain Korean, 1-2 sentences.
- designerSummary: concise designer-facing reasoning.
- adjustmentNotes: concise notes reflecting the chosen branch, context, and execution details.
- confusionWarnings: array of short warnings.
- strategySummary: 2-3 sentences in Korean. Why this direction makes sense from a brand strategy perspective. Include positioning logic and competitive differentiation rationale.
- strategyPositioningContext: 1-2 sentences. How this direction fits the brand's market position and target audience.
- strategyPersuasionGuide: 1-2 sentences. How to explain this direction to the client if they have concerns.`;
```

userMessage에 브랜치의 전략 필드 포함:

```ts
- Primary branch strategy: ${primaryBranch ? primaryBranch.descriptionStrategy : 'none'}
- Positioning context: ${primaryBranch ? primaryBranch.positioningContext : 'none'}
- Competitive implication: ${primaryBranch ? primaryBranch.competitiveImplication : 'none'}
```

### 5-3. `src/app/api/brief/[id]/generate/route.ts` 수정

**BriefOutput 생성 시 전략 필드 포함** (line 132-149)

```ts
const brief: BriefOutput = {
    // ... 기존 필드 유지 ...
    inputRole: sessionState.inputRole ?? 'client',
    strategySummary: llmSummary.strategySummary ?? primaryBranch.descriptionStrategy,
    strategyPositioningContext: llmSummary.strategyPositioningContext ?? primaryBranch.positioningContext,
    strategyPersuasionGuide: llmSummary.strategyPersuasionGuide ?? '',
};
```

**fallback summary에도 전략 필드 추가** (line 27-50, `generateFallbackSummary` 함수)

```ts
function generateFallbackSummary(
    primaryBranch: Branch,
    eliminatedBranches: Branch[]
): LLMBriefResponse {
    // ... 기존 로직 유지 ...
    return {
        // ... 기존 필드 유지 ...
        strategySummary: primaryBranch.descriptionStrategy,
        strategyPositioningContext: primaryBranch.positioningContext,
        strategyPersuasionGuide: '',
    };
}
```

---

## Phase 6: 기존 기능 호환성 보장

### 6-1. `src/lib/questionEngine.ts` — 변경 없음
정적 엔진은 Branch의 기존 필드만 사용. 새 필드 무시됨. 수정 불필요.

### 6-2. `src/lib/triggerMatcher.ts` — 변경 없음
triggerMatcher는 triggers.json만 참조. branches.json의 새 필드 영향 없음.

### 6-3. `src/lib/sessionFlow.ts` — 변경 없음
sessionState 재구성 시 inputRole은 그대로 전달됨.

### 6-4. `src/lib/briefStore.ts` — 변경 없음
JSON 직렬화이므로 필드 추가에 자동 대응.

### 6-5. `src/lib/briefExport.ts` — 변경 없음
DOM → PDF 변환이므로 HTML 구조가 바뀌면 자동 반영.

### 6-6. `src/app/api/session/[id]/answer/route.ts` — 최소 수정
sessionState를 그대로 전달하므로 inputRole 필드는 자동 보존됨. 수정 불필요.

### 6-7. `src/app/api/session/[id]/refine/route.ts` — 최소 수정
sessionState를 그대로 전달하므로 inputRole 필드는 자동 보존됨. 수정 불필요.

### 6-8. `src/app/api/session/refine-feedback/route.ts` — 변경 없음

### 6-9. `src/app/api/brief/[id]/route.ts` — 변경 없음
저장된 brief를 그대로 반환. 새 필드 자동 포함.

### 6-10. `src/app/brief/[id]/page.tsx` — 수정 필요
Permalink 브리프 뷰에도 전략 섹션 표시 필요.
BriefStep과 동일한 전략 섹션 렌더링 추가.

### 6-11. `src/data/context.json` — 변경 없음
strategist 모드에서는 이 데이터를 직접 참조하지 않지만, projectStage는 여전히 사용.
client 모드에서는 기존대로 동작.

### 6-12. `src/data/tokens.json` — 변경 없음
디자인 토큰은 브랜치 결정 이후 참조. 모드와 무관.

### 6-13. `src/data/triggers.json` — 변경 없음
트리거 매칭은 client 모드에서만 사용. strategist 모드에서는 트리거 매칭 없이 LLM 직접 분석.

---

## 구현 순서 (의존성 기준)

```
1. types/ontology.ts          ← 모든 파일이 의존. 가장 먼저.
2. data/branches.json          ← 타입에 맞게 필드 추가
3. data/briefTemplate.json     ← 섹션 순서 변경
4. lib/constants.ts            ← 변경 없음 (확인만)
5. lib/llmOrchestrator.ts      ← 시그니처 변경 + 프롬프트 확장
6. store/sessionStore.ts       ← inputRole 상태 추가
7. app/api/session/start       ← inputRole 수신, 전달
8. app/api/brief/generate      ← 전략 필드 포함 brief 생성
9. components/steps/RoleStep   ← 신규 파일 생성
10. components/StepContainer   ← RoleStep import 추가
11. components/ProgressBar     ← 'role' 단계 추가
12. components/steps/EntryStep ← 역할별 분기
13. components/steps/ContextStep ← strategist UI 추가
14. components/steps/ConfirmStep ← 전략 미리보기 추가
15. components/steps/BriefStep ← 전략 섹션 추가
16. app/brief/[id]/page.tsx    ← permalink에도 전략 섹션
```

---

## 검증 체크리스트

- [ ] `npm run build` 통과 (타입 에러 없음)
- [ ] `npm run lint` 통과
- [ ] client 모드: 기존 흐름 그대로 동작 (역할 선택 → 피드백 → 객관식 맥락 → 질문 → 확인 → 브리프)
- [ ] strategist 모드: 역할 선택 → 전략 입력 → 자유입력 맥락 → 질문(더 적음) → 확인 → 브리프
- [ ] Brief에 A~H 8개 섹션 모두 렌더링
- [ ] 전략 섹션(C)에 strategySummary, positioningContext, persuasionGuide 표시
- [ ] ConfirmStep에서 descriptionStrategy 표시
- [ ] Permalink 브리프에도 전략 섹션 표시
- [ ] fallback(정적 엔진) 모드에서도 전략 필드 정상 출력
- [ ] PDF 다운로드 시 전략 섹션 포함
- [ ] reset 시 step이 'role'로 초기화
- [ ] 기존 저장된 brief(inputRole 없는)도 permalink에서 깨지지 않음

---

## 변경하지 않는 파일 (확인용)

| 파일 | 이유 |
|------|------|
| `lib/questionEngine.ts` | Branch 기존 필드만 사용 |
| `lib/triggerMatcher.ts` | triggers.json만 참조 |
| `lib/sessionFlow.ts` | sessionState passthrough |
| `lib/briefStore.ts` | JSON 직렬화 |
| `lib/briefExport.ts` | DOM → PDF |
| `api/session/[id]/answer` | sessionState passthrough |
| `api/session/[id]/refine` | sessionState passthrough |
| `api/session/refine-feedback` | inputRole 무관 |
| `api/brief/[id]/route.ts` | 저장된 JSON 반환 |
| `data/context.json` | client 모드에서 기존대로 |
| `data/tokens.json` | 모드 무관 |
| `data/triggers.json` | client 모드 전용 |
