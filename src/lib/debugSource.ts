import type { DebugSourceKind } from '@/types/ontology';

type DebugStage = 'question' | 'result' | 'brief';

type DebugBanner = {
    message: string;
    className: string;
};

const TONE_CLASS: Record<DebugSourceKind, string> = {
    language_model: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    fallback: 'border border-amber-200 bg-amber-50 text-amber-700',
    deterministic: 'border border-blue-200 bg-blue-50 text-blue-700',
    hybrid: 'border border-indigo-200 bg-indigo-50 text-indigo-700',
};

const COPY: Record<DebugStage, Record<DebugSourceKind, string>> = {
    question: {
        language_model: '현재 질문은 언어 모델이 생성하고 있습니다.',
        fallback: '현재 질문은 대체 질문 엔진이 생성하고 있습니다.',
        deterministic: '현재 질문은 규칙 기반 전략 흐름으로 생성되고 있습니다.',
        hybrid: '현재 질문은 언어 모델 분석과 규칙 기반 흐름을 함께 반영하고 있습니다.',
    },
    result: {
        language_model: '이 결과는 언어 모델 해석을 바탕으로 정리했습니다.',
        fallback: '이 결과는 대체 로직을 바탕으로 정리했습니다.',
        deterministic: '이 결과는 규칙 기반 정리 로직을 바탕으로 만들었습니다.',
        hybrid: '이 결과는 언어 모델 분석과 규칙 기반 정리를 함께 반영했습니다.',
    },
    brief: {
        language_model: '이 브리프는 언어 모델을 사용해 생성했습니다.',
        fallback: '이 브리프는 대체 로직을 사용해 생성했습니다.',
        deterministic: '이 브리프는 규칙 기반 정리 로직으로 생성했습니다.',
        hybrid: '이 브리프는 언어 모델 분석과 규칙 기반 정리를 함께 사용해 생성했습니다.',
    },
};

export function getDebugBanner(
    stage: DebugStage,
    source: DebugSourceKind | undefined
): DebugBanner | null {
    if (!source) {
        return null;
    }

    return {
        message: COPY[stage][source],
        className: TONE_CLASS[source],
    };
}
