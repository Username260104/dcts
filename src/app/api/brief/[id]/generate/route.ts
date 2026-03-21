import { NextRequest, NextResponse } from 'next/server';
import branches from '@/data/branches.json';
import tokens from '@/data/tokens.json';
import { saveBrief } from '@/lib/briefStore';
import { generateBriefSummary } from '@/lib/llmOrchestrator';
import type {
    Branch,
    BriefDecisionStep,
    BriefOutput,
    DesignToken,
    GenerateBriefRequest,
    GenerateBriefResponse,
    LLMBriefResponse,
} from '@/types/ontology';

const branchData = branches as Branch[];
const tokenData = tokens as DesignToken[];

function findBranch(id: string): Branch | undefined {
    return branchData.find((branch) => branch.branchId === id);
}

function findToken(id: string): DesignToken | undefined {
    return tokenData.find((token) => token.branchId === id);
}

function generateFallbackSummary(
    primaryBranch: Branch,
    eliminatedBranches: Branch[]
): LLMBriefResponse {
    const clientAntiSummary = eliminatedBranches
        .slice(0, 2)
        .map((branch) => branch.descriptionClient)
        .join(', ');

    const confusionWarnings = primaryBranch.confusableBranches
        .map((branchId) => findBranch(branchId))
        .filter((branch): branch is Branch => branch !== undefined)
        .map((branch) => `${branch.branchLabel}와 혼동 주의: ${primaryBranch.distinctionKey}`);

    return {
        clientSummary: `말씀하신 방향은 ${primaryBranch.descriptionClient}에 더 가깝습니다.`,
        clientAntiSummary: clientAntiSummary
            ? `${clientAntiSummary} 쪽으로 가자는 뜻은 아닌 것으로 해석했습니다.`
            : '',
        designerSummary: `${primaryBranch.branchLabel}(${primaryBranch.branchId}) 기준으로 해석했습니다. ${primaryBranch.descriptionDesigner}`,
        adjustmentNotes: '선택된 방향과 현재 맥락을 기준으로 브리프를 생성했습니다.',
        confusionWarnings,
    };
}

function buildDecisionTrail(sessionState: GenerateBriefRequest['sessionState']): BriefDecisionStep[] {
    return sessionState.answerHistory.map((answer) => ({
        question: answer.question,
        selectedOption: answer.selectedLabel,
        availableOptions: answer.options.map((option) => option.label),
        nextAction: answer.nextAction ?? 'conclusion',
        nextPrompt: answer.nextQuestion,
        nextOptions: answer.nextOptions?.map((option) => option.label),
        nextReason:
            answer.nextReason?.trim() || '선택을 반영해 다음 분기 또는 최종 해석으로 이어졌습니다.',
    }));
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;
        const body: GenerateBriefRequest = await request.json();
        const { sessionState } = body;

        if (!sessionState?.primaryBranch) {
            return NextResponse.json(
                { error: '세션 결과에 primaryBranch가 없습니다.' },
                { status: 400 }
            );
        }

        const primaryBranch = findBranch(sessionState.primaryBranch);
        if (!primaryBranch) {
            return NextResponse.json(
                { error: `브랜치를 찾을 수 없습니다: ${sessionState.primaryBranch}` },
                { status: 404 }
            );
        }

        const secondaryBranch = sessionState.secondaryBranch
            ? findBranch(sessionState.secondaryBranch) ?? null
            : null;

        const primaryToken = findToken(sessionState.primaryBranch);
        if (!primaryToken) {
            return NextResponse.json(
                { error: `디자인 토큰을 찾을 수 없습니다: ${sessionState.primaryBranch}` },
                { status: 404 }
            );
        }

        const eliminatedBranches = sessionState.eliminated
            .map((branchId) => findBranch(branchId))
            .filter((branch): branch is Branch => branch !== undefined);

        let llmSummary: LLMBriefResponse;

        try {
            llmSummary = await generateBriefSummary(sessionState);
            console.info('[LLM] brief/generate succeeded', { sessionId });
        } catch (error) {
            console.warn('[LLM] brief/generate fallback summary', {
                sessionId,
                reason: error instanceof Error ? error.message : String(error),
            });
            llmSummary = generateFallbackSummary(primaryBranch, eliminatedBranches);
        }

        const neverDoList = [
            ...primaryToken.neverDo.split(/[.,]/).map((item) => item.trim()).filter(Boolean),
            ...(primaryBranch.excludedTokens ?? []),
        ];

        const antiReferences = primaryBranch.confusableBranches
            .map((branchId) => findBranch(branchId))
            .filter((branch): branch is Branch => branch !== undefined)
            .flatMap((branch) =>
                branch.references.map((reference) => `${reference} (${branch.branchLabel}와 혼동 주의)`)
            )
            .filter((reference, index, self) => self.indexOf(reference) === index)
            .slice(0, 4);

        const brief: BriefOutput = {
            originalFeedback: sessionState.originalFeedback,
            feedbackType: sessionState.feedbackType ?? 'ambiguous',
            userContext: sessionState.userContext,
            generatedAt: new Date().toISOString(),
            clientSummary: llmSummary.clientSummary,
            clientAntiSummary: llmSummary.clientAntiSummary,
            primaryBranch,
            secondaryBranch,
            eliminatedBranches,
            interpretationRationale: llmSummary.designerSummary,
            designTokens: primaryToken,
            neverDoList: [...new Set(neverDoList)],
            confusionWarnings: llmSummary.confusionWarnings,
            references: primaryBranch.references,
            antiReferences,
            decisionTrail: buildDecisionTrail(sessionState),
        };

        try {
            await saveBrief(sessionId, brief, llmSummary);
        } catch (error) {
            // Vercel serverless deployments may not support app-local persistence.
            console.warn('[API] brief/generate save skipped', {
                sessionId,
                reason: error instanceof Error ? error.message : String(error),
            });
        }

        const response: GenerateBriefResponse = {
            brief,
            llmSummary,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] brief/generate error:', error);
        return NextResponse.json(
            { error: '브리프 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
