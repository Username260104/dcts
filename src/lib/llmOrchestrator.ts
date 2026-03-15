import Anthropic from '@anthropic-ai/sdk';
import branches from '@/data/branches.json';
import context from '@/data/context.json';
import tokens from '@/data/tokens.json';
import type {
    Branch,
    ContextVariables,
    DesignToken,
    LLMBriefResponse,
    LLMFollowUpResponse,
    LLMInitialAnalysis,
    RefineFeedbackResponse,
    SessionState,
    UserContext,
} from '@/types/ontology';
import { MAX_QUESTIONS } from './constants';

const branchData = branches as Branch[];
const ctxData = context as ContextVariables;
const tokenData = tokens as DesignToken[];

type LLMProvider = 'anthropic' | 'gemini';

type GeminiGenerateContentResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message?: string;
    };
};

function getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();

    if (provider === 'gemini') return 'gemini';
    if (provider === 'anthropic') return 'anthropic';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    return 'anthropic';
}

function getAnthropicClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    return new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
}

function getAnthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
}

function getGeminiModel(): string {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}

function compressBranches(candidateIds?: string[]): string {
    const target = candidateIds
        ? branchData.filter((branch) => candidateIds.includes(branch.branchId))
        : branchData;

    return JSON.stringify(
        target.map((branch) => ({
            id: branch.branchId,
            label: branch.branchLabel,
            adjective: branch.adjective,
            descriptionDesigner: branch.descriptionDesigner,
            descriptionClient: branch.descriptionClient,
            confusable: branch.confusableBranches,
            distinctionKey: branch.distinctionKey,
            contrastQuestion: branch.contrastQuestion,
            antiSignals: branch.antiSignals,
            references: branch.references,
        }))
    );
}

function compressContext(userContext: UserContext): string {
    const result: Record<string, { boost: string[]; suppress: string[] }> = {};

    if (userContext.industry && ctxData.industry[userContext.industry]) {
        const option = ctxData.industry[userContext.industry];
        result.industry = { boost: option.boost, suppress: option.suppress };
    }
    if (userContext.pricePosition && ctxData.pricePosition[userContext.pricePosition]) {
        const option = ctxData.pricePosition[userContext.pricePosition];
        result.pricePosition = { boost: option.boost, suppress: option.suppress };
    }
    if (userContext.projectStage && ctxData.projectStage[userContext.projectStage]) {
        const option = ctxData.projectStage[userContext.projectStage];
        result.projectStage = { boost: option.boost, suppress: option.suppress };
    }
    if (userContext.targetAge && ctxData.targetAge[userContext.targetAge]) {
        const option = ctxData.targetAge[userContext.targetAge];
        result.targetAge = { boost: option.boost, suppress: option.suppress };
    }

    return JSON.stringify(result);
}

const BASE_SYSTEM_PROMPT = `You are DCTS, a question engine for translating vague client design feedback into a concrete direction.

Rules:
- Ask in plain Korean suitable for non-designers.
- Do not use design jargon in questions or options.
- Ask one question at a time.
- Always frame questions relative to the current proposal.
- Keep the total question count to ${MAX_QUESTIONS} or fewer.
- Prefer questions that reduce the candidate branches most effectively.
- Output JSON only, with no markdown fences or extra prose.
- Never invent branches outside the provided ontology.

If the feedback mixes multiple qualities, you may reflect that in primary/secondary interpretation, but still stay within the provided branch IDs.`;

function parseJSON<T>(text: string): T {
    let cleaned = text.trim();

    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }

    return JSON.parse(cleaned.trim()) as T;
}

function validateBranchIds(ids: string[]): string[] {
    const validIds = branchData.map((branch) => branch.branchId);
    return ids.filter((id) => validIds.includes(id));
}

async function callAnthropic(systemPrompt: string, userMessage: string): Promise<string> {
    const client = getAnthropicClient();

    const response = await client.messages.create({
        model: getAnthropicModel(),
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Anthropic response did not contain text');
    }

    return textBlock.text;
}

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: userMessage }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    const payload = (await response.json()) as GeminiGenerateContentResponse;

    if (!response.ok) {
        throw new Error(payload.error?.message || `Gemini request failed with ${response.status}`);
    }

    const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim();

    if (!text) {
        throw new Error('Gemini response did not contain text');
    }

    return text;
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    if (getProvider() === 'gemini') {
        return callGemini(systemPrompt, userMessage);
    }

    return callAnthropic(systemPrompt, userMessage);
}

export async function analyzeInitialFeedback(
    feedbackText: string,
    userContext: UserContext
): Promise<LLMInitialAnalysis> {
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

Ontology branches:
${compressBranches()}

Context weighting:
${compressContext(userContext)}`;

    const userMessage = `Client feedback: "${feedbackText}"

Return this JSON exactly:
{
  "feedbackType": "directional" | "negative" | "ambiguous",
  "axis": "string",
  "candidates": ["branch ids"],
  "eliminated": ["branch ids"],
  "question": "plain Korean question",
  "options": [
    { "label": "option text", "direction": "branchId or comma-separated branchIds" },
    { "label": "option text", "direction": "branchId or comma-separated branchIds" },
    { "label": "잘 모르겠어요", "direction": "" }
  ]
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMInitialAnalysis>(rawResponse);
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminated = validateBranchIds(parsed.eliminated);
            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Initial LLM analysis failed');
}

export async function refineFeedbackExpression(
    feedbackText: string,
    userContext: UserContext
): Promise<RefineFeedbackResponse> {
    const systemPrompt = `You expand client feedback into a more specific Korean expression for a design feedback intake flow.

Rules:
- Preserve the client's original intent.
- Do not add intent that the client did not write or imply.
- Make the emotional direction more explicit only when it is already implied.
- Do not use design jargon.
- Limit the output to 1 or 2 plain Korean sentences.
- Refer to the ontology and context internally, but never expose branch labels, IDs, or ontology structure.
- Return JSON only.`;

    const userMessage = `Original feedback: "${feedbackText}"

Ontology reference:
${compressBranches()}

Context weighting:
${compressContext(userContext)}

Return JSON:
{
  "refinedText": "one refined Korean expression"
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<RefineFeedbackResponse>(rawResponse);
            parsed.refinedText = parsed.refinedText.trim();

            if (!parsed.refinedText) {
                throw new Error('Refined feedback is empty');
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Feedback refinement failed');
}

export async function generateFollowUp(
    sessionState: SessionState
): Promise<LLMFollowUpResponse> {
    const systemPrompt = `${BASE_SYSTEM_PROMPT}

Candidate branches:
${compressBranches(sessionState.candidates)}

Context weighting:
${compressContext(sessionState.userContext)}`;

    const history = sessionState.answerHistory
        .map(
            (answer, index) =>
                `Q${index + 1}: "${answer.question}" -> "${answer.selectedLabel}" (${answer.selectedDirection || 'none'})`
        )
        .join('\n');

    const userMessage = `Session state
- Original feedback: "${sessionState.originalFeedback}"
- History:
${history || '(none)'}
- Remaining candidates: [${sessionState.candidates.join(', ')}]
- Eliminated: [${sessionState.eliminated.join(', ')}]
- Question count: ${sessionState.questionCount}/${MAX_QUESTIONS}

Return JSON:
{
  "eliminatedNow": ["branch ids"],
  "eliminationReason": "string",
  "candidates": ["branch ids"],
  "converged": true | false,
  "question": "plain Korean question if not converged",
  "options": [
    { "label": "option text", "direction": "branch id(s)" },
    { "label": "option text", "direction": "branch id(s)" },
    { "label": "잘 모르겠어요", "direction": "" }
  ],
  "primaryBranch": "branch id if converged",
  "secondaryBranch": "branch id or null if converged",
  "reasoning": "string if converged"
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMFollowUpResponse>(rawResponse);
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminatedNow = validateBranchIds(parsed.eliminatedNow);

            if (parsed.primaryBranch) {
                const validated = validateBranchIds([parsed.primaryBranch]);
                parsed.primaryBranch = validated[0] || parsed.candidates[0];
            }

            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Follow-up LLM generation failed');
}

export async function generateDetailQuestion(
    sessionState: SessionState
): Promise<LLMFollowUpResponse> {
    const primaryBranch = sessionState.primaryBranch
        ? branchData.find((branch) => branch.branchId === sessionState.primaryBranch)
        : null;
    const secondaryBranch = sessionState.secondaryBranch
        ? branchData.find((branch) => branch.branchId === sessionState.secondaryBranch)
        : null;
    const primaryToken = sessionState.primaryBranch
        ? tokenData.find((token) => token.branchId === sessionState.primaryBranch)
        : null;

    if (!primaryBranch) {
        throw new Error('Primary branch is required for detail questions');
    }

    const history = sessionState.answerHistory
        .map((answer, index) => `Q${index + 1}: "${answer.question}" -> "${answer.selectedLabel}"`)
        .join('\n');
    const usedDetailFocuses = sessionState.detailFocusHistory ?? [];
    const remainingDetailFocuses = ['color', 'typography', 'layout', 'imagery', 'texture']
        .filter((focus) => !usedDetailFocuses.includes(focus));

    const systemPrompt = `${BASE_SYSTEM_PROMPT}

You are now in the detail refinement phase.
- The ontology branch has already been selected.
- Do not ask branch-selection questions again.
- Ask an execution-level question that sharpens the brief.
- Choose exactly one detail focus from: color, typography, layout, imagery, texture.
- Prefer a focus that has not been asked yet.
- Keep it in plain Korean.
- Return converged=false with one question until enough detail is collected.`;

    const userMessage = `Current resolved direction
- Original feedback: "${sessionState.originalFeedback}"
- Primary branch: ${primaryBranch.branchId} (${primaryBranch.branchLabel})
- Secondary branch: ${secondaryBranch ? `${secondaryBranch.branchId} (${secondaryBranch.branchLabel})` : 'none'}
- Detail questions already asked: ${sessionState.detailQuestionCount ?? 0}
- Used detail focuses: ${usedDetailFocuses.join(', ') || 'none'}
- Preferred remaining detail focuses: ${remainingDetailFocuses.join(', ') || 'none'}
- Full history:
${history || '(none)'}

Primary design token:
${primaryToken ? JSON.stringify(primaryToken) : 'none'}

Return JSON:
{
  "eliminatedNow": [],
  "eliminationReason": "detail refinement",
  "candidates": ["${primaryBranch.branchId}"${secondaryBranch ? `, "${secondaryBranch.branchId}"` : ''}],
  "converged": false,
  "detailFocus": "color | typography | layout | imagery | texture",
  "question": "plain Korean question",
  "options": [
    { "label": "option text", "direction": "detail:option-a" },
    { "label": "option text", "direction": "detail:option-b" },
    { "label": "잘 모르겠어요", "direction": "detail:unclear" }
  ]
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            const parsed = parseJSON<LLMFollowUpResponse>(rawResponse);
            parsed.candidates = validateBranchIds(parsed.candidates);
            parsed.eliminatedNow = [];
            parsed.converged = false;
            parsed.detailFocus = parsed.detailFocus || remainingDetailFocuses[0] || 'layout';
            return parsed;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Detail question generation failed');
}

export async function generateBriefSummary(
    sessionState: SessionState
): Promise<LLMBriefResponse> {
    const primaryBranch = branchData.find((branch) => branch.branchId === sessionState.primaryBranch);
    const secondaryBranch = sessionState.secondaryBranch
        ? branchData.find((branch) => branch.branchId === sessionState.secondaryBranch)
        : null;
    const primaryToken = tokenData.find((token) => token.branchId === sessionState.primaryBranch);
    const eliminatedBranches = sessionState.eliminated
        .map((id) => branchData.find((branch) => branch.branchId === id))
        .filter(Boolean);

    const systemPrompt = `You are generating a final DCTS brief summary.

Return JSON only.
- clientSummary: plain Korean, 2-3 sentences
- clientAntiSummary: plain Korean, 1-2 sentences
- designerSummary: concise designer-facing reasoning
- adjustmentNotes: concise notes reflecting the chosen branch, context, and execution details captured in later refinement answers
- confusionWarnings: array of short warnings`;

    const history = sessionState.answerHistory
        .map((answer, index) => `Q${index + 1}: "${answer.question}" -> "${answer.selectedLabel}"`)
        .join('\n');

    const userMessage = `Final session result
- Original feedback: "${sessionState.originalFeedback}"
- Primary branch: ${primaryBranch ? `${primaryBranch.branchId} (${primaryBranch.branchLabel}) ${primaryBranch.descriptionDesigner}` : 'none'}
- Secondary branch: ${secondaryBranch ? `${secondaryBranch.branchId} (${secondaryBranch.branchLabel})` : 'none'}
- Eliminated branches: ${eliminatedBranches.map((branch) => branch ? `${branch.branchId}(${branch.branchLabel})` : '').join(', ') || 'none'}
- Reasoning: ${sessionState.reasoning || 'none'}
- Detail focuses covered: ${(sessionState.detailFocusHistory ?? []).join(', ') || 'none'}
- History:
${history || '(none)'}

Primary design token:
${primaryToken ? JSON.stringify(primaryToken) : 'none'}

Confusable branches:
${primaryBranch
        ? primaryBranch.confusableBranches
            .map((id) => {
                const branch = branchData.find((candidate) => candidate.branchId === id);
                return branch ? `${branch.branchId}(${branch.branchLabel}): ${primaryBranch.distinctionKey}` : '';
            })
            .filter(Boolean)
            .join('\n')
        : 'none'}

Return JSON:
{
  "clientSummary": "string",
  "clientAntiSummary": "string",
  "designerSummary": "string",
  "adjustmentNotes": "string",
  "confusionWarnings": ["string"]
}`;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const rawResponse = await callLLM(systemPrompt, userMessage);
            return parseJSON<LLMBriefResponse>(rawResponse);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) continue;
        }
    }

    throw lastError ?? new Error('Brief summary generation failed');
}
