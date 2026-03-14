import Anthropic from '@anthropic-ai/sdk';
import branches from '@/data/branches.json';
import context from '@/data/context.json';
import tokens from '@/data/tokens.json';
import type {
    Branch,
    ContextVariables,
    DesignToken,
    UserContext,
    LLMInitialAnalysis,
    LLMFollowUpResponse,
    LLMBriefResponse,
    SessionState,
} from '@/types/ontology';
import { MAX_QUESTIONS } from './constants';

const branchData = branches as Branch[];
const ctxData = context as ContextVariables;
const tokenData = tokens as DesignToken[];

// Anthropic 클라이언트 (서버 사이드 전용)
function getClient(): Anthropic {
    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
}

// --- 시스템 프롬프트 구성 ---

// 온톨로지 분기 데이터를 압축 형태로 변환 (토큰 절약)
function compressBranches(candidateIds?: string[]): string {
    const target = candidateIds
        ? branchData.filter((b) => candidateIds.includes(b.branchId))
        : branchData;

    return JSON.stringify(
        target.map((b) => ({
            id: b.branchId,
            label: b.branchLabel,
            adj: b.adjective,
            descDesigner: b.descriptionDesigner,
            descClient: b.descriptionClient,
            confusable: b.confusableBranches,
            distinctionKey: b.distinctionKey,
            contrastQ: b.contrastQuestion,
            antiSignals: b.antiSignals,
            refs: b.references,
        })),
        null,
        0
    );
}

// 맥락 변수에서 현재 세션에 해당하는 boost/suppress만 추출
function compressContext(userContext: UserContext): string {
    const result: Record<string, { boost: string[]; suppress: string[] }> = {};

    if (userContext.industry && ctxData.industry[userContext.industry]) {
        const opt = ctxData.industry[userContext.industry];
        result.industry = { boost: opt.boost, suppress: opt.suppress };
    }
    if (userContext.pricePosition && ctxData.pricePosition[userContext.pricePosition]) {
        const opt = ctxData.pricePosition[userContext.pricePosition];
        result.pricePosition = { boost: opt.boost, suppress: opt.suppress };
    }
    if (userContext.projectStage && ctxData.projectStage[userContext.projectStage]) {
        const opt = ctxData.projectStage[userContext.projectStage];
        result.projectStage = { boost: opt.boost, suppress: opt.suppress };
    }
    if (userContext.targetAge && ctxData.targetAge[userContext.targetAge]) {
        const opt = ctxData.targetAge[userContext.targetAge];
        result.targetAge = { boost: opt.boost, suppress: opt.suppress };
    }

    return JSON.stringify(result);
}

// 기본 시스템 프롬프트
const BASE_SYSTEM_PROMPT = `당신은 DCTS(Design Communication Translation System)의 질문 엔진입니다.

## 당신의 역할
브랜드 디자인 에이전시의 클라이언트가 수정 피드백을 보냈습니다.
클라이언트의 머릿속에는 분명히 원하는 그림이 있지만, 디자인 어휘의 한계로 모호하게 전달됩니다.
당신은 산파법 질문을 통해 그 그림을 구체화하는 역할입니다.

## 핵심 원칙
1. 디자인 전문 용어를 절대 사용하지 않는다. 클라이언트는 디자인을 모른다.
2. 모든 질문은 "지금 시안 대비" 프레임이다. 절대 좌표가 아니라 상대적 방향을 묻는다.
3. 한 번에 하나의 질문만. 선택지는 2~3개. "둘 다 아닌데요" 옵션 항상 포함.
4. 총 질문은 ${MAX_QUESTIONS}개 이내. 매 질문은 남은 후보 분기를 가장 효율적으로 줄이는 것을 선택.
5. 이전 답변이 이후 질문의 방향을 결정한다. 이미 확정된 축은 다시 묻지 않는다.
6. 질문의 톤은 부드럽고 안심시키는 느낌. "틀린 답은 없어요" 뉘앙스.

## 엔트로피 최소화 전략
다음 질문을 생성할 때, 남은 후보 분기들 사이에서 가장 큰 차이를 드러내는 축을 선택하라.
이미 확정된 축은 다시 묻지 마라.

## 교차 감성 처리
클라이언트의 피드백이 두 개 이상의 감성 축에 걸칠 경우,
단일 분기 선택이 아니라 primary/secondary 가중 판정을 내려라.
충돌하는 토큰은 primary 우선.

## 온톨로지 데이터
아래는 이 시스템의 감성 해석 분기 데이터입니다. 37개 분기, 12개 감성 축.
이 데이터 안에서만 판단합니다. 데이터에 없는 분기를 만들어내지 않습니다.

## 응답 형식
반드시 JSON만 응답하라. 마크다운 백틱, 설명문, 프리앰블 금지. 순수 JSON만 반환.`;

// --- LLM 호출 함수 ---

// JSON 파싱 (백틱 제거 + 재시도 로직)
function parseJSON<T>(text: string): T {
    // 마크다운 코드블록 제거
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    return JSON.parse(cleaned) as T;
}

// 분기 ID 유효성 검증
function validateBranchIds(ids: string[]): string[] {
    const validIds = branchData.map((b) => b.branchId);
    return ids.filter((id) => validIds.includes(id));
}

// LLM API 호출 (공통)
async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    const client = getClient();

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
            { role: 'user', content: userMessage },
        ],
        system: systemPrompt,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
        throw new Error('LLM 응답에 텍스트가 없습니다');
    }
    return textBlock.text;
}

// --- 호출 1: 초기 분석 ---

export async function analyzeInitialFeedback(
    feedbackText: string,
    userContext: UserContext
): Promise<LLMInitialAnalysis> {
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${compressBranches()}

## 맥락 변수 가중치
${compressContext(userContext)}`;

    const userMessage = `클라이언트의 원문 피드백: "${feedbackText}"

다음을 JSON으로 응답하라:
{
  "feedbackType": "directional" | "negative" | "ambiguous",
  "axis": "관련 감성 축 (예: 품격/가치)",
  "candidates": ["후보 분기 ID 배열"],
  "eliminated": ["초기 배제 분기 ID 배열 (안티 시그널 기반)"],
  "question": "첫 번째 질문 (클라이언트용 비전문가 언어)",
  "options": [
    {"label": "선택지 텍스트", "direction": "관련 분기 ID (콤마 구분)"},
    {"label": "선택지 텍스트", "direction": "관련 분기 ID"},
    {"label": "둘 다 아닌데요", "direction": ""}
  ]
}

주의사항:
- candidates와 eliminated의 분기 ID는 온톨로지 데이터에 있는 것만 사용
- 맥락 변수의 boost 분기를 candidates 상위에, suppress 분기를 하위에 배치
- 질문과 선택지에 디자인 전문 용어 절대 사용 금지
- 마지막 선택지는 반드시 "둘 다 아닌데요" (direction: "")`;

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMInitialAnalysis>(rawResponse);

            // 분기 ID 유효성 검증
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminated = validateBranchIds(parsed.eliminated);

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < MAX_RETRIES) continue;
        }
    }

    throw lastError ?? new Error('LLM 초기 분석 실패');
}

// --- 호출 2~N: 후속 질문 생성 ---

export async function generateFollowUp(
    sessionState: SessionState
): Promise<LLMFollowUpResponse> {
    // 남은 후보 분기 데이터만 컨텍스트에 포함 (토큰 절약)
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

${compressBranches(sessionState.candidates)}

## 맥락 변수 가중치
${compressContext(sessionState.userContext)}`;

    // 응답 이력 요약
    const historyStr = sessionState.answerHistory
        .map((a, i) => `Q${i + 1}: "${a.question}" → 선택: "${a.selectedLabel}" (방향: ${a.selectedDirection || '없음'})`)
        .join('\n');

    const userMessage = `## 현재 세션 상태
- 원문 피드백: "${sessionState.originalFeedback}"
- 질문-응답 이력:
${historyStr || '(아직 없음)'}
- 남은 후보 분기: [${sessionState.candidates.join(', ')}]
- 배제된 분기: [${sessionState.eliminated.join(', ')}]
- 현재 질문 횟수: ${sessionState.questionCount}/${MAX_QUESTIONS}

다음을 JSON으로 응답하라:
{
  "eliminatedNow": ["이번에 추가로 배제할 분기 ID"],
  "eliminationReason": "배제 이유 (한국어)",
  "candidates": ["갱신된 후보 분기 ID 배열"],
  "converged": true/false,

  // converged가 false인 경우:
  "question": "다음 질문 (클라이언트용)",
  "options": [
    {"label": "선택지", "direction": "분기ID"},
    {"label": "선택지", "direction": "분기ID"},
    {"label": "둘 다 아닌데요", "direction": ""}
  ],

  // converged가 true인 경우:
  "primaryBranch": "최종 1순위 분기 ID",
  "secondaryBranch": "2순위 분기 ID 또는 null",
  "reasoning": "판정 근거 (한국어)"
}

수렴 조건:
- 남은 후보가 2개 이하일 때 수렴
- 질문 횟수가 ${MAX_QUESTIONS}에 도달하면 강제 수렴 (현재까지 정보로 최선 판정)
- 연속으로 같은 방향이 선택되면 수렴 가능`;

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMFollowUpResponse>(rawResponse);

            // 분기 ID 유효성 검증
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminatedNow = validateBranchIds(parsed.eliminatedNow);
            if (parsed.primaryBranch) {
                const valid = validateBranchIds([parsed.primaryBranch]);
                parsed.primaryBranch = valid[0] || parsed.candidates[0];
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < MAX_RETRIES) continue;
        }
    }

    throw lastError ?? new Error('LLM 후속 질문 생성 실패');
}

// --- 호출 최종: 브리프 해석 요약 생성 ---

export async function generateBriefSummary(
    sessionState: SessionState
): Promise<LLMBriefResponse> {
    const primaryBranch = branchData.find((b) => b.branchId === sessionState.primaryBranch);
    const secondaryBranch = sessionState.secondaryBranch
        ? branchData.find((b) => b.branchId === sessionState.secondaryBranch)
        : null;
    const primaryToken = tokenData.find((t) => t.branchId === sessionState.primaryBranch);

    const eliminatedBranches = sessionState.eliminated
        .map((id) => branchData.find((b) => b.branchId === id))
        .filter(Boolean);

    const systemPrompt = `당신은 DCTS의 브리프 생성기입니다.
질문 엔진이 수렴한 결과를 바탕으로, 두 종류의 해석 요약을 생성합니다.

## 클라이언트용 요약 원칙
- 비전문가 언어만 사용
- 2~3문장으로 "이렇게 이해했는데 맞으세요?" 톤
- 비유와 일상 언어 사용 (예: "비싼 호텔 로비처럼")

## 디자이너용 요약 원칙
- 전문 용어 적극 사용
- 확정 분기의 핵심 특성과 배제 분기의 차이를 명확히
- 근거 기반 (질문-응답 이력 참조)

## 응답 형식
반드시 JSON만 응답하라.`;

    const historyStr = sessionState.answerHistory
        .map((a, i) => `Q${i + 1}: "${a.question}" → "${a.selectedLabel}"`)
        .join('\n');

    const userMessage = `## 세션 결과
- 원문 피드백: "${sessionState.originalFeedback}"
- 확정 분기: ${primaryBranch ? `${primaryBranch.branchId} (${primaryBranch.branchLabel}) — ${primaryBranch.descriptionDesigner}` : '없음'}
- 2순위 분기: ${secondaryBranch ? `${secondaryBranch.branchId} (${secondaryBranch.branchLabel})` : '없음'}
- 배제 분기: ${eliminatedBranches.map((b) => b ? `${b.branchId}(${b.branchLabel})` : '').join(', ') || '없음'}
- 판정 근거: ${sessionState.reasoning || '없음'}
- 질문-응답 이력:
${historyStr}

## 디자인 토큰 (확정 분기)
${primaryToken ? JSON.stringify(primaryToken) : '없음'}

## 혼동 분기 정보
${primaryBranch ? primaryBranch.confusableBranches.map((id) => {
        const cb = branchData.find((b) => b.branchId === id);
        return cb ? `${cb.branchId}(${cb.branchLabel}): ${primaryBranch.distinctionKey}` : '';
    }).filter(Boolean).join('\n') : '없음'}

다음을 JSON으로 응답하라:
{
  "clientSummary": "클라이언트 확인용 해석 요약 (비전문가 언어, 2~3문장)",
  "clientAntiSummary": "이건 아닌 방향 요약 (1~2문장)",
  "designerSummary": "디자이너용 해석 요약 (전문 용어, 근거 포함, 3~5문장)",
  "adjustmentNotes": "현재 맥락을 반영한 조정 방향 요약 (2~3문장)",
  "confusionWarnings": ["혼동 주의 경고 문장 배열"]
}`;

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            return parseJSON<LLMBriefResponse>(rawResponse);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < MAX_RETRIES) continue;
        }
    }

    throw lastError ?? new Error('LLM 브리프 요약 생성 실패');
}
