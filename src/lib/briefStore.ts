import { promises as fs } from 'fs';
import path from 'path';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

interface StoredBrief {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
    createdAt: string;
}

const briefsDir = path.join(process.cwd(), '.runtime', 'briefs');

function getBriefPath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(briefsDir, `${safeId}.json`);
}

export async function saveBrief(
    id: string,
    brief: BriefOutput,
    llmSummary: LLMBriefResponse
): Promise<void> {
    await fs.mkdir(briefsDir, { recursive: true });

    const payload: StoredBrief = {
        brief,
        llmSummary,
        createdAt: new Date().toISOString(),
    };

    await fs.writeFile(
        getBriefPath(id),
        JSON.stringify(payload, null, 2),
        'utf-8'
    );
}

export async function getBrief(id: string): Promise<StoredBrief | null> {
    try {
        const raw = await fs.readFile(getBriefPath(id), 'utf-8');
        return JSON.parse(raw) as StoredBrief;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

export async function hasBrief(id: string): Promise<boolean> {
    return (await getBrief(id)) !== null;
}
