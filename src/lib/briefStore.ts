import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

// MVP용 in-memory 브리프 저장소 (서버 재시작 시 초기화됨)
interface StoredBrief {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
    createdAt: string;
}

const store = new Map<string, StoredBrief>();

export function saveBrief(id: string, brief: BriefOutput, llmSummary: LLMBriefResponse): void {
    store.set(id, { brief, llmSummary, createdAt: new Date().toISOString() });
}

export function getBrief(id: string): StoredBrief | undefined {
    return store.get(id);
}

export function hasBrief(id: string): boolean {
    return store.has(id);
}
