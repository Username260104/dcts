import { NextRequest, NextResponse } from 'next/server';
import branches from '@/data/branches.json';
import tokens from '@/data/tokens.json';
import { saveBrief } from '@/lib/briefStore';
import {
    generateDesignTranslationBrief,
    generateGapMemo,
    generateInterpretationBrief,
    mapStrategySchemaToBranches,
} from '@/lib/llmOrchestrator';
import type {
    Branch,
    BriefDecisionStep,
    BriefOutput,
    DesignToken,
    GenerateBriefRequest,
    GenerateBriefResponse,
    LLMBriefResponse,
    SessionState,
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
        clientSummary: `말씀하신 방향은 ${primaryBranch.descriptionClient}에 가장 가깝습니다.`,
        clientAntiSummary: clientAntiSummary
            ? `${clientAntiSummary} 쪽으로 가려는 요청은 아닌 것으로 해석했습니다.`
            : '',
        designerSummary: `${primaryBranch.branchLabel}(${primaryBranch.branchId}) 기준으로 해석했습니다. ${primaryBranch.descriptionDesigner}`,
        adjustmentNotes: '선택된 방향과 현재 맥락을 기준으로 브리프를 생성했습니다.',
        confusionWarnings,
        strategySummary: primaryBranch.descriptionStrategy,
        strategyPositioningContext: primaryBranch.positioningContext,
        strategyPersuasionGuide: '',
    };
}

function buildDecisionTrail(sessionState: SessionState): BriefDecisionStep[] {
    return sessionState.answerHistory.map((answer) => ({
        question: answer.question,
        selectedOption: answer.selectedLabel,
        availableOptions: answer.options.map((option) => option.label),
        nextAction: answer.nextAction ?? 'conclusion',
        nextPrompt: answer.nextQuestion,
        nextOptions: answer.nextOptions?.map((option) => option.label),
        nextReason:
            answer.nextReason?.trim() || '선택을 반영해 다음 질문 또는 최종 결과로 이동했습니다.',
    }));
}

function buildStrategyBrief(sessionState: SessionState): {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
    briefSource: 'hybrid';
} {
    const strategyState = sessionState.strategyState;

    if (!strategyState) {
        throw new Error('Strategy state is required');
    }

    const branchMapping = mapStrategySchemaToBranches(strategyState, sessionState.userContext);
    const enrichedState = {
        ...strategyState,
        branchMapping,
    };

    if (strategyState.readinessStatus === 'ready') {
        const translationBrief = generateDesignTranslationBrief(
            enrichedState,
            sessionState.userContext,
            sessionState.originalFeedback
        );

        const brief: BriefOutput = {
            briefKind: 'translation_brief',
            jobType: 'strategy_to_design_translation',
            originalFeedback: sessionState.originalFeedback,
            userContext: sessionState.userContext,
            generatedAt: new Date().toISOString(),
            inputRole: sessionState.inputRole ?? 'strategist',
            decisionTrail: buildDecisionTrail(sessionState),
            strategySummary: strategyState.summary ?? translationBrief.strategicPremise,
            strategyPositioningContext: translationBrief.frameOfReference,
            strategyPersuasionGuide: translationBrief.mappingRationale,
            strategyTranslation: translationBrief,
        };

        return {
            brief,
            llmSummary: {
                strategySummary: brief.strategySummary,
                strategyPositioningContext: brief.strategyPositioningContext,
                strategyPersuasionGuide: brief.strategyPersuasionGuide,
            },
            briefSource: 'hybrid',
        };
    }

    const gapMemo = generateGapMemo(enrichedState);
    const brief: BriefOutput = {
        briefKind: 'gap_memo',
        jobType: 'strategy_to_design_translation',
        originalFeedback: sessionState.originalFeedback,
        userContext: sessionState.userContext,
        generatedAt: new Date().toISOString(),
        inputRole: sessionState.inputRole ?? 'strategist',
        decisionTrail: buildDecisionTrail(sessionState),
        strategySummary: strategyState.summary ?? '',
        gapMemo,
    };

    return {
        brief,
        llmSummary: {
            strategySummary: strategyState.summary ?? '',
        },
        briefSource: 'hybrid',
    };
}

async function buildClientBrief(sessionState: SessionState): Promise<{
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
    briefSource: 'language_model' | 'fallback';
}> {
    if (!sessionState.primaryBranch) {
        throw new Error('primaryBranch is required');
    }

    const primaryBranch = findBranch(sessionState.primaryBranch);
    if (!primaryBranch) {
        throw new Error(`Branch not found: ${sessionState.primaryBranch}`);
    }

    const secondaryBranch = sessionState.secondaryBranch
        ? findBranch(sessionState.secondaryBranch) ?? null
        : null;

    const primaryToken = findToken(sessionState.primaryBranch);
    if (!primaryToken) {
        throw new Error(`Design token not found: ${sessionState.primaryBranch}`);
    }

    const eliminatedBranches = sessionState.eliminated
        .map((branchId) => findBranch(branchId))
        .filter((branch): branch is Branch => branch !== undefined);

    let llmSummary: LLMBriefResponse;
    let briefSource: 'language_model' | 'fallback' = 'language_model';

    try {
        llmSummary = await generateInterpretationBrief(sessionState);
        console.info('[LLM] brief/generate succeeded', { sessionId: sessionState.sessionId });
    } catch (error) {
        console.warn('[LLM] brief/generate fallback summary', {
            sessionId: sessionState.sessionId,
            reason: error instanceof Error ? error.message : String(error),
        });
        llmSummary = generateFallbackSummary(primaryBranch, eliminatedBranches);
        briefSource = 'fallback';
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
        briefKind: 'interpretation_brief',
        jobType: 'client_feedback_interpretation',
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
        confusionWarnings: llmSummary.confusionWarnings ?? [],
        references: primaryBranch.references,
        antiReferences,
        decisionTrail: buildDecisionTrail(sessionState),
        inputRole: sessionState.inputRole ?? 'client',
        strategySummary: llmSummary.strategySummary ?? primaryBranch.descriptionStrategy,
        strategyPositioningContext: llmSummary.strategyPositioningContext ?? primaryBranch.positioningContext,
        strategyPersuasionGuide: llmSummary.strategyPersuasionGuide ?? '',
    };

    return {
        brief,
        llmSummary,
        briefSource,
    };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;
        const body: GenerateBriefRequest = await request.json();
        const { sessionState } = body;

        if (!sessionState) {
            return NextResponse.json(
                { error: '세션 상태가 필요합니다.' },
                { status: 400 }
            );
        }

        const payload = sessionState.jobType === 'strategy_to_design_translation'
            ? buildStrategyBrief(sessionState)
            : await buildClientBrief(sessionState);

        try {
            await saveBrief(sessionId, payload.brief, payload.llmSummary);
        } catch (error) {
            console.warn('[API] brief/generate save skipped', {
                sessionId,
                reason: error instanceof Error ? error.message : String(error),
            });
        }

        const response: GenerateBriefResponse = {
            brief: payload.brief,
            llmSummary: payload.llmSummary,
            debugState: {
                briefSource: payload.briefSource,
            },
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
