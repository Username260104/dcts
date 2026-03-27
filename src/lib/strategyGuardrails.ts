export type StrategyGuardrailSource = 'mustAvoid' | 'noGo';

export interface StrategyGuardrailGroups {
    perceptionRisks: string[];
    operationalConstraints: string[];
    strategicGuardrails: string[];
}

function normalizeGuardrailText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

export function looksLikeOperationalConstraint(value: string): boolean {
    return /(로고|교체|변경|금지|제외|불가|유지|반영|구조|레이아웃|메탈릭|컬러|타이포|패키지|웹|상세페이지|시스템|가이드|네이밍|심볼|노출|규격|사용)/i.test(value);
}

export function looksLikePerceptionRisk(value: string): boolean {
    return /(인상|무드|느낌|톤|처럼|읽히|보이|과잉|차갑|가볍|거리감|대중적|낯설|광고 같|광고처럼)/i.test(value);
}

export function classifyStrategyGuardrail(
    value: string,
    source: StrategyGuardrailSource
): keyof StrategyGuardrailGroups {
    if (looksLikeOperationalConstraint(value)) {
        return 'operationalConstraints';
    }

    if (source === 'mustAvoid') {
        return 'perceptionRisks';
    }

    if (looksLikePerceptionRisk(value)) {
        return 'perceptionRisks';
    }

    return 'strategicGuardrails';
}

export function partitionStrategyGuardrails(values: {
    mustAvoid?: string[];
    noGo?: string[];
}): StrategyGuardrailGroups {
    const grouped: StrategyGuardrailGroups = {
        perceptionRisks: [],
        operationalConstraints: [],
        strategicGuardrails: [],
    };

    const pushUnique = (bucket: keyof StrategyGuardrailGroups, value: string) => {
        const normalized = normalizeGuardrailText(value);

        if (!normalized || grouped[bucket].includes(normalized)) {
            return;
        }

        grouped[bucket].push(normalized);
    };

    for (const value of values.mustAvoid ?? []) {
        pushUnique(classifyStrategyGuardrail(value, 'mustAvoid'), value);
    }

    for (const value of values.noGo ?? []) {
        pushUnique(classifyStrategyGuardrail(value, 'noGo'), value);
    }

    return grouped;
}

export function hasPerceptionRiskSignal(values: {
    mustAvoid?: string[];
    noGo?: string[];
}): boolean {
    return partitionStrategyGuardrails(values).perceptionRisks.length > 0;
}
