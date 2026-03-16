import { NextRequest, NextResponse } from 'next/server';
import { refineFeedbackExpression } from '@/lib/llmOrchestrator';
import type { RefineFeedbackRequest, RefineFeedbackResponse } from '@/types/ontology';

const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? '15000');

export async function POST(request: NextRequest) {
    try {
        const body: RefineFeedbackRequest = await request.json();

        if (!body.feedbackText || body.feedbackText.trim().length === 0) {
            return NextResponse.json(
                { error: '피드백을 입력해 주세요.' },
                { status: 400 }
            );
        }

        const llmPromise = refineFeedbackExpression(body.feedbackText, body.context);
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS)
        );

        const result = await Promise.race([llmPromise, timeoutPromise]) as RefineFeedbackResponse;

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API] session/refine-feedback error:', error);
        return NextResponse.json(
            { error: '표현 다듬기 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
