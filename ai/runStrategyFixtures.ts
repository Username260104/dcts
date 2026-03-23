import { inspect } from 'node:util';
import {
    buildStrategyStateFromSchema,
    generateDesignTranslationBrief,
    generateGapMemo,
    mapStrategySchemaToBranches,
} from '../src/lib/llmOrchestrator';
import {
    strategyFixtures,
    type StrategyFixture,
} from '../src/lib/strategyFixtures';

type FixtureFailure = {
    fixtureId: string;
    label: string;
    failures: string[];
    debug?: Record<string, unknown>;
};

function flattenValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(flattenValue).join(' ');
    }

    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>)
            .map(flattenValue)
            .join(' ');
    }

    return typeof value === 'string' ? value : String(value ?? '');
}

function assertIncludes(
    failures: string[],
    haystack: string,
    expectedValues: string[] | undefined,
    label: string
) {
    for (const expectedValue of expectedValues ?? []) {
        if (!haystack.includes(expectedValue)) {
            failures.push(`${label}에 "${expectedValue}"가 포함되지 않았습니다.`);
        }
    }
}

function assertArrayIncludes(
    failures: string[],
    actualValues: string[],
    expectedValues: string[] | undefined,
    label: string
) {
    for (const expectedValue of expectedValues ?? []) {
        if (!actualValues.includes(expectedValue)) {
            failures.push(`${label}에 "${expectedValue}"가 포함되지 않았습니다.`);
        }
    }
}

function runFixture(fixture: StrategyFixture): FixtureFailure | null {
    const baseState = buildStrategyStateFromSchema(
        fixture.artifactType,
        fixture.schema,
        fixture.userContext
    );
    const branchMapping = mapStrategySchemaToBranches(baseState, fixture.userContext);
    const strategyState = {
        ...baseState,
        branchMapping,
    };
    const failures: string[] = [];

    if (strategyState.readinessStatus !== fixture.expectations.readinessStatus) {
        failures.push(
            `readinessStatus 예상값(${fixture.expectations.readinessStatus})과 실제값(${strategyState.readinessStatus})이 다릅니다.`
        );
    }

    assertArrayIncludes(
        failures,
        strategyState.missingFields,
        fixture.expectations.missingFields,
        'missingFields'
    );
    assertArrayIncludes(
        failures,
        strategyState.weakFields,
        fixture.expectations.weakFields,
        'weakFields'
    );

    if (
        fixture.expectations.contradictionsAtLeast !== undefined &&
        strategyState.contradictions.length < fixture.expectations.contradictionsAtLeast
    ) {
        failures.push(
            `contradictions 수가 ${fixture.expectations.contradictionsAtLeast}개 이상이어야 하지만 실제는 ${strategyState.contradictions.length}개입니다.`
        );
    }

    if (strategyState.readinessStatus === 'ready') {
        const brief = generateDesignTranslationBrief(
            strategyState,
            fixture.userContext,
            fixture.originalFeedback
        );
        const serializedBrief = flattenValue(brief);

        assertIncludes(failures, brief.strategicPremise, fixture.expectations.premiseIncludes, 'strategicPremise');
        assertIncludes(failures, brief.coreTension, fixture.expectations.coreTensionIncludes, 'coreTension');
        assertIncludes(failures, serializedBrief, fixture.expectations.decisionFrameIncludes, 'decisionFrame');
        assertIncludes(failures, serializedBrief, fixture.expectations.creativeImplicationsInclude, 'creativeImplications');
        assertIncludes(failures, serializedBrief, fixture.expectations.surfaceImplicationsInclude, 'surfaceImplications');
        assertIncludes(failures, serializedBrief, fixture.expectations.confirmedInputsInclude, 'confirmedInputs');
        assertIncludes(failures, serializedBrief, fixture.expectations.designerChecklistInclude, 'designerChecklist');
    } else {
        const gapMemo = generateGapMemo(strategyState);
        const serializedGapMemo = flattenValue(gapMemo);

        assertIncludes(failures, serializedGapMemo, fixture.expectations.priorityGapsInclude, 'priorityGaps');
        assertIncludes(failures, serializedGapMemo, fixture.expectations.premiseIncludes, 'gapMemo');
    }

    if (failures.length === 0) {
        const summary = strategyState.readinessStatus === 'ready'
            ? `${strategyState.readinessStatus} | ${strategyState.summary}`
            : `${strategyState.readinessStatus} | gaps=${strategyState.diagnosis.prioritizedGaps.slice(0, 2).join(' / ')}`;
        console.log(`PASS ${fixture.id}: ${summary}`);
        return null;
    }

    return {
        fixtureId: fixture.id,
        label: fixture.label,
        failures,
        debug: {
            readinessStatus: strategyState.readinessStatus,
            missingFields: strategyState.missingFields,
            weakFields: strategyState.weakFields,
            contradictions: strategyState.contradictions,
            prioritizedGaps: strategyState.diagnosis.prioritizedGaps,
        },
    };
}

function main() {
    const failures = strategyFixtures
        .map(runFixture)
        .filter((result): result is FixtureFailure => result !== null);

    if (failures.length === 0) {
        console.log(`\n${strategyFixtures.length}개 전략 fixture가 모두 통과했습니다.`);
        return;
    }

    console.error(`\n${failures.length}개 fixture에서 실패가 발생했습니다.\n`);

    for (const failure of failures) {
        console.error(`- ${failure.fixtureId} (${failure.label})`);
        for (const message of failure.failures) {
            console.error(`  - ${message}`);
        }
    }

    console.error('\n디버그용 전체 실패 내용:');
    console.error(inspect(failures, { depth: 5, colors: false }));
    process.exitCode = 1;
}

main();
