import { NextRequest, NextResponse } from 'next/server';
import { generateBriefSummary } from '@/lib/llmOrchestrator';
import { saveBrief } from '@/lib/briefStore';
import branches from '@/data/branches.json';
import tokens from '@/data/tokens.json';
import type {
    Branch,
    DesignToken,
    GenerateBriefRequest,
    GenerateBriefResponse,
    BriefOutput,
    LLMBriefResponse,
} from '@/types/ontology';

const branchData = branches as Branch[];
const tokenData = tokens as DesignToken[];

function findBranch(id: string): Branch | undefined {
    return branchData.find((b) => b.branchId === id);
}

function findToken(id: string): DesignToken | undefined {
    return tokenData.find((t) => t.branchId === id);
}

// LLM 실패 시 정적 fallback 요약 생성
function generateFallbackSummary(
    primaryBranch: Branch,
    eliminatedBranches: Branch[]
): LLMBriefResponse {
    const antiLabels = eliminatedBranches
        .slice(0, 2)
        .map((b) => b.descriptionClient)
        .join(', ');

    const warnings: string[] = [];
    primaryBranch.confusableBranches.forEach((confId) => {
        const confBranch = findBranch(confId);
        if (confBranch) {
            warnings.push(
                `${confBranch.branchLabel}과(와) 혼동 주의: ${primaryBranch.distinctionKey}`
            );
        }
    });

    return {
        clientSummary: `말씀하신 '${primaryBranch.adjective}' 느낌은 ${primaryBranch.descriptionClient}에 가까운 것 같아요. 맞으신가요?`,
        clientAntiSummary: antiLabels ? `${antiLabels} 같은 느낌은 아닌 것 같아요.` : '',
        designerSummary: `확정 분기: ${primaryBranch.branchLabel} (${primaryBranch.branchId}). ${primaryBranch.descriptionDesigner}`,
        adjustmentNotes: '온톨로지 토큰 기반 조정 방향을 참고하세요.',
        confusionWarnings: warnings,
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

        if (!sessionState?.primaryBranch) {
            return NextResponse.json(
                { error: '수렴 결과가 필요합니다. primaryBranch가 없습니다.' },
                { status: 400 }
            );
        }

        const primary = findBranch(sessionState.primaryBranch);
        if (!primary) {
            return NextResponse.json(
                { error: `분기를 찾을 수 없습니다: ${sessionState.primaryBranch}` },
                { status: 404 }
            );
        }

        const secondary = sessionState.secondaryBranch
            ? findBranch(sessionState.secondaryBranch) ?? null
            : null;

        const primaryToken = findToken(sessionState.primaryBranch);
        if (!primaryToken) {
            return NextResponse.json(
                { error: `디자인 토큰을 찾을 수 없습니다: ${sessionState.primaryBranch}` },
                { status: 404 }
            );
        }

        const eliminatedBranchObjs = sessionState.eliminated
            .map((id) => findBranch(id))
            .filter((b): b is Branch => b !== undefined);

        // LLM 브리프 요약 생성
        let llmSummary: LLMBriefResponse;

        try {
            llmSummary = await generateBriefSummary(sessionState);
        } catch {
            // LLM 실패 시 정적 fallback
            llmSummary = generateFallbackSummary(primary, eliminatedBranchObjs);
        }

        // 배제 토큰 종합 (중복 제거)
        const neverDoList = [
            ...primaryToken.neverDo.split(/[.,]/).map((s) => s.trim()).filter(Boolean),
            ...primary.excludedTokens,
        ];
        const uniqueNeverDo = [...new Set(neverDoList)];

        // 안티 레퍼런스 생성
        const antiReferences: string[] = [];
        primary.confusableBranches.forEach((confId) => {
            const confBranch = findBranch(confId);
            if (confBranch) {
                confBranch.references.forEach((ref) => {
                    if (!antiReferences.includes(ref)) {
                        antiReferences.push(`${ref} (${confBranch.branchLabel} 혼동 주의)`);
                    }
                });
            }
        });

        // 최종 브리프 조합
        const brief: BriefOutput = {
            // A. 원문 피드백
            originalFeedback: sessionState.originalFeedback,
            feedbackType: sessionState.feedbackType ?? 'ambiguous',
            userContext: sessionState.userContext,
            generatedAt: new Date().toISOString(),

            // B. 해석 요약 (LLM 생성 자연어)
            clientSummary: llmSummary.clientSummary,
            clientAntiSummary: llmSummary.clientAntiSummary,

            // C. 해석 요약 (디자이너용)
            primaryBranch: primary,
            secondaryBranch: secondary,
            eliminatedBranches: eliminatedBranchObjs,
            interpretationRationale: llmSummary.designerSummary,

            // D. 핵심 조정 포인트
            designTokens: primaryToken,

            // E. 절대 하지 말 것
            neverDoList: uniqueNeverDo,
            confusionWarnings: llmSummary.confusionWarnings,

            // F. 레퍼런스
            references: primary.references,
            antiReferences: antiReferences.slice(0, 4),
        };

        // 브리프 퍼머링크용 저장 (ISSUE 5c)
        saveBrief(sessionId, brief, llmSummary);

        const response: GenerateBriefResponse = {
            brief,
            llmSummary,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] brief/generate 에러:', error);
        return NextResponse.json(
            { error: '브리프 생성 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
