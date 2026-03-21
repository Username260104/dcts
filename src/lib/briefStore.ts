import { promises as fs } from 'fs';
import path from 'path';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

interface StoredBrief {
    brief: BriefOutput;
    llmSummary: LLMBriefResponse;
    createdAt: string;
}

const briefsDir = path.join(process.cwd(), '.runtime', 'briefs');
const briefKeyPrefix = 'brief';

type RedisConfig = {
    url: string;
    token: string;
};

function getBriefPath(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(briefsDir, `${safeId}.json`);
}

function getBriefKey(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return `${briefKeyPrefix}:${safeId}`;
}

function getRedisConfig(): RedisConfig | null {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
        || process.env.KV_REST_API_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
        || process.env.KV_REST_API_TOKEN?.trim();

    if (!url || !token) {
        return null;
    }

    return { url: url.replace(/\/$/, ''), token };
}

function getBriefTtlSeconds(): number | null {
    const value = process.env.BRIEF_TTL_SECONDS?.trim();
    if (!value) return null;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.floor(parsed);
}

async function redisSet(key: string, value: StoredBrief): Promise<void> {
    const redis = getRedisConfig();
    if (!redis) {
        throw new Error('Redis brief store is not configured');
    }

    const ttl = getBriefTtlSeconds();
    const commandPath = ttl
        ? `/set/${encodeURIComponent(key)}/EX/${ttl}`
        : `/set/${encodeURIComponent(key)}`;

    const response = await fetch(`${redis.url}${commandPath}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${redis.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
    });

    if (!response.ok) {
        throw new Error(`Redis SET failed with ${response.status}`);
    }
}

async function redisGet(key: string): Promise<StoredBrief | null> {
    const redis = getRedisConfig();
    if (!redis) {
        throw new Error('Redis brief store is not configured');
    }

    const response = await fetch(`${redis.url}/get/${encodeURIComponent(key)}`, {
        headers: {
            Authorization: `Bearer ${redis.token}`,
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Redis GET failed with ${response.status}`);
    }

    const payload = await response.json() as { result?: string | null };
    if (!payload.result) {
        return null;
    }

    return JSON.parse(payload.result) as StoredBrief;
}

export async function saveBrief(
    id: string,
    brief: BriefOutput,
    llmSummary: LLMBriefResponse
): Promise<void> {
    const payload: StoredBrief = {
        brief,
        llmSummary,
        createdAt: new Date().toISOString(),
    };

    if (getRedisConfig()) {
        await redisSet(getBriefKey(id), payload);
        return;
    }

    await fs.mkdir(briefsDir, { recursive: true });
    await fs.writeFile(getBriefPath(id), JSON.stringify(payload, null, 2), 'utf-8');
}

export async function getBrief(id: string): Promise<StoredBrief | null> {
    if (getRedisConfig()) {
        return redisGet(getBriefKey(id));
    }

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
