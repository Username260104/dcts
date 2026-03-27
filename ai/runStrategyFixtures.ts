import { inspect } from 'node:util';
import {
    buildStrategyStateFromSchema,
    generateDesignTranslationBrief,
    generateGapMemo,
    generateStrategyGapQuestion,
    mergeStrategyAnswerIntoState,
    mapStrategySchemaToBranches,
} from '../src/lib/llmOrchestrator';
import {
    buildStrategyGapDisplayModel,
    buildStrategyTranslationDisplayModel,
} from '../src/lib/strategyBriefPresenter';
import {
    strategyFixtures,
    type StrategyFixture,
} from '../src/lib/strategyFixtures';
import type { BriefOutput } from '../src/types/ontology';

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

function assertQuestionFlow(
    failures: string[],
    fixture: StrategyFixture,
    strategyState: ReturnType<typeof buildStrategyStateFromSchema>
) {
    const flow = fixture.expectations.questionFlow;

    if (!flow) {
        return;
    }

    const initialQuestion = generateStrategyGapQuestion(strategyState, fixture.userContext);

    if (flow.expectNoQuestion) {
        if (initialQuestion) {
            failures.push(`questionFlow는 질문이 없어야 하지만 실제로는 "${initialQuestion.question}" 질문이 생성됐습니다.`);
        }
        return;
    }

    if (!initialQuestion) {
        failures.push('questionFlow 기대값이 있지만 초기 질문이 생성되지 않았습니다.');
        return;
    }

    if (flow.initialTargetField && initialQuestion.meta?.targetField !== flow.initialTargetField) {
        failures.push(
            `초기 질문 targetField 예상값(${flow.initialTargetField})과 실제값(${initialQuestion.meta?.targetField ?? 'none'})이 다릅니다.`
        );
    }

    if (flow.initialQuestionKind && initialQuestion.meta?.questionKind !== flow.initialQuestionKind) {
        failures.push(
            `초기 질문 kind 예상값(${flow.initialQuestionKind})과 실제값(${initialQuestion.meta?.questionKind ?? 'none'})이 다릅니다.`
        );
    }

    assertIncludes(failures, initialQuestion.question, flow.initialQuestionIncludes, 'initialQuestion');
    assertArrayIncludes(
        failures,
        initialQuestion.options.map((option) => option.label),
        flow.initialOptionIncludes,
        'initialQuestion.options'
    );

    if (
        !flow.nextTargetFieldAfterFirstChoice
        && !flow.nextQuestionKindAfterFirstChoice
        && !(flow.nextQuestionIncludesAfterFirstChoice?.length)
    ) {
        return;
    }

    const firstConcreteOption = initialQuestion.options.find((option) => (
        option.direction
        && !option.direction.startsWith('noop|')
        && !option.direction.startsWith('fallback|')
    ));

    if (!firstConcreteOption || !initialQuestion.meta) {
        failures.push('후속 질문 검증을 위한 유효한 첫 번째 선택지를 찾지 못했습니다.');
        return;
    }

    const nextState = mergeStrategyAnswerIntoState(
        strategyState,
        initialQuestion.meta,
        firstConcreteOption.label,
        firstConcreteOption.direction,
        fixture.userContext
    );
    const nextQuestion = generateStrategyGapQuestion(nextState, fixture.userContext);

    if (!nextQuestion) {
        failures.push('후속 질문 기대값이 있지만 첫 응답 뒤 다음 질문이 생성되지 않았습니다.');
        return;
    }

    if (flow.nextTargetFieldAfterFirstChoice && nextQuestion.meta?.targetField !== flow.nextTargetFieldAfterFirstChoice) {
        failures.push(
            `후속 질문 targetField 예상값(${flow.nextTargetFieldAfterFirstChoice})과 실제값(${nextQuestion.meta?.targetField ?? 'none'})이 다릅니다.`
        );
    }

    if (flow.nextQuestionKindAfterFirstChoice && nextQuestion.meta?.questionKind !== flow.nextQuestionKindAfterFirstChoice) {
        failures.push(
            `후속 질문 kind 예상값(${flow.nextQuestionKindAfterFirstChoice})과 실제값(${nextQuestion.meta?.questionKind ?? 'none'})이 다릅니다.`
        );
    }

    assertIncludes(
        failures,
        nextQuestion.question,
        flow.nextQuestionIncludesAfterFirstChoice,
        'nextQuestion'
    );
}

function buildStrategyFixtureBrief(
    fixture: StrategyFixture,
    strategySummary?: string
): BriefOutput {
    return {
        briefKind: 'translation_brief',
        jobType: 'strategy_to_design_translation',
        originalFeedback: fixture.originalFeedback,
        userContext: fixture.userContext,
        generatedAt: new Date().toISOString(),
        inputRole: 'strategist',
        strategySummary: strategySummary ?? '',
    };
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

    assertQuestionFlow(failures, fixture, strategyState);

    if (strategyState.readinessStatus === 'ready') {
        const brief = generateDesignTranslationBrief(
            strategyState,
            fixture.userContext,
            fixture.originalFeedback
        );
        const translationDisplay = buildStrategyTranslationDisplayModel({
            ...buildStrategyFixtureBrief(fixture, strategyState.summary),
            strategyTranslation: brief,
        });
        const serializedBrief = flattenValue(brief);
        const serializedDisplay = flattenValue(translationDisplay);

        assertIncludes(failures, brief.strategicPremise, fixture.expectations.premiseIncludes, 'strategicPremise');
        assertIncludes(failures, brief.coreTension, fixture.expectations.coreTensionIncludes, 'coreTension');
        assertIncludes(failures, serializedBrief, fixture.expectations.decisionFrameIncludes, 'decisionFrame');
        assertIncludes(failures, serializedBrief, fixture.expectations.creativeImplicationsInclude, 'creativeImplications');
        assertIncludes(failures, serializedBrief, fixture.expectations.surfaceImplicationsInclude, 'surfaceImplications');
        assertIncludes(failures, serializedBrief, fixture.expectations.confirmedInputsInclude, 'confirmedInputs');
        assertIncludes(failures, serializedBrief, fixture.expectations.designerChecklistInclude, 'designerChecklist');
        assertIncludes(failures, serializedDisplay, fixture.expectations.translationDisplayIncludes, 'translationDisplay');
    } else {
        const gapMemo = generateGapMemo(strategyState);
        const gapDisplay = buildStrategyGapDisplayModel({
            ...buildStrategyFixtureBrief(fixture, strategyState.summary),
            briefKind: 'gap_memo',
            gapMemo,
        });
        const serializedGapMemo = flattenValue(gapMemo);
        const serializedGapDisplay = flattenValue(gapDisplay);

        assertIncludes(failures, serializedGapMemo, fixture.expectations.priorityGapsInclude, 'priorityGaps');
        assertIncludes(failures, serializedGapMemo, fixture.expectations.premiseIncludes, 'gapMemo');
        assertIncludes(failures, serializedGapDisplay, fixture.expectations.gapDisplayIncludes, 'gapDisplay');
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
