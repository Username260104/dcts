import type {
    ReadinessStatus,
    StrategyArtifactType,
    StrategyFieldKey,
    StrategyTranslationSchema,
    UserContext,
} from '@/types/ontology';

export interface StrategyFixtureExpectations {
    readinessStatus: ReadinessStatus;
    missingFields?: StrategyFieldKey[];
    weakFields?: StrategyFieldKey[];
    contradictionsAtLeast?: number;
    premiseIncludes?: string[];
    coreTensionIncludes?: string[];
    decisionFrameIncludes?: string[];
    creativeImplicationsInclude?: string[];
    surfaceImplicationsInclude?: string[];
    confirmedInputsInclude?: string[];
    priorityGapsInclude?: string[];
    designerChecklistInclude?: string[];
    translationDisplayIncludes?: string[];
    gapDisplayIncludes?: string[];
    questionFlow?: {
        expectNoQuestion?: boolean;
        initialTargetField?: StrategyFieldKey | 'artifactType';
        initialQuestionKind?: string;
        initialQuestionIncludes?: string[];
        initialOptionIncludes?: string[];
        nextTargetFieldAfterFirstChoice?: StrategyFieldKey | 'artifactType';
        nextQuestionKindAfterFirstChoice?: string;
        nextQuestionIncludesAfterFirstChoice?: string[];
    };
}

export interface StrategyFixture {
    id: string;
    label: string;
    originalFeedback: string;
    artifactType: StrategyArtifactType;
    userContext: UserContext;
    schema: StrategyTranslationSchema;
    expectations: StrategyFixtureExpectations;
}

export const strategyFixtures: StrategyFixture[] = [
    {
        id: 'beauty_identity_refresh_ready',
        label: '프리미엄 스킨케어 리프레시 handoff ready',
        originalFeedback: '30대 여성 대상 프리미엄 스킨케어 리브랜딩입니다. 패키지와 상세페이지에서 신뢰감은 유지하되 더 세련되고 자신감 있게 보여야 합니다.',
        artifactType: 'identity_refresh_scope',
        userContext: {
            industry: 'beauty',
            pricePosition: 'premium',
            projectStage: 'refresh',
            targetAge: '30s',
            brandDescription: '성분 기반 프리미엄 스킨케어 브랜드',
            positioningNote: '대중적으로 접근 가능하지만 시각적으로는 한 단계 정제되고 신뢰감 있어야 함',
            additionalContext: '패키지와 상세페이지를 함께 조정하며 기존 고객의 익숙함은 유지해야 함',
        },
        schema: {
            businessChallenge: '기존 신뢰감을 해치지 않으면서도 리프레시 이후 브랜드가 더 세련되고 자신감 있게 느껴지게 만든다.',
            audienceContext: '성분에 민감한 30대 여성 고객이 패키지와 상세페이지에서 전문성과 일상적 만족감을 함께 느껴야 한다.',
            frameOfReference: '프리미엄 스킨케어 카테고리 안에서 클리닉 톤과 감성 럭셔리 톤 사이의 중간 지점',
            pointsOfDifference: ['성분 전문성과 감각적 만족감의 균형', '부담스럽지 않은 프리미엄 인상'],
            valueProposition: '믿고 오래 쓸 수 있는 프리미엄 스킨케어를 더 감각적인 인상으로 재정의한다.',
            reasonsToBelieve: ['성분 기반 제품력', '장기 사용 고객의 신뢰', '전문성 있는 정보 전달 구조'],
            equitiesToProtect: ['깨끗하고 절제된 톤', '과장되지 않은 프리미엄감', '기존 고객이 느끼는 신뢰감'],
            mustAmplify: ['세련된 자신감', '브랜드만의 존재감'],
            mustAvoid: ['차갑고 병원 같은 인상', '거리감 있는 럭셔리 하우스 무드'],
            decisionPriority: ['신뢰감 유지', '세련된 존재감 강화', '과도한 럭셔리 회피'],
            tradeOffs: ['미니멀함은 유지하되 무표정해지면 안 된다.'],
            mandatories: ['패키지 전면과 상세페이지 첫 화면 모두 적용 가능해야 한다.', '화이트 기반 정보 전달 구조는 유지한다.'],
            noGo: ['로고 전면 교체', '메탈릭 과잉 연출'],
            scope: '패키지, 상세페이지, 핵심 브랜드 표현 톤을 조정한다.',
            scopeNow: '패키지 전면, 상세페이지 첫 화면, 주요 정보 계층을 우선 조정한다.',
            reviewCriteria: ['첫 인상에서 신뢰감과 세련된 존재감이 함께 읽히는가', '기존 고객이 낯설지 않게 브랜드를 알아보는가', '패키지와 상세페이지에 같은 방향이 일관되게 적용되는가'],
            openQuestionsForDesign: ['타이포 존재감을 어디까지 올려도 기존 고객 이탈 없이 유지되는가'],
        },
        expectations: {
            readinessStatus: 'ready',
            premiseIncludes: ['세련되고 자신감'],
            coreTensionIncludes: ['차갑고 병원 같은 인상'],
            decisionFrameIncludes: ['이번 차수 범위'],
            creativeImplicationsInclude: ['첫 인상'],
            surfaceImplicationsInclude: ['패키지 전면', '상세페이지'],
            confirmedInputsInclude: ['원문 입력', '산출물 유형'],
            designerChecklistInclude: ['세련된 자신감', '브랜드를 알아보는가'],
            questionFlow: {
                expectNoQuestion: true,
            },
        },
    },
    {
        id: 'fintech_positioning_gap',
        label: '핀테크 포지셔닝 입력이 아직 추상적인 케이스',
        originalFeedback: '요즘 경쟁사보다 더 믿음직하고 세련되게 보이면 좋겠습니다.',
        artifactType: 'positioning',
        userContext: {
            industry: 'finance',
            pricePosition: 'mid',
            projectStage: 'launch',
            targetAge: '20s_30s',
            brandDescription: '간편 송금과 예산 관리를 돕는 핀테크 앱',
            additionalContext: '앱 첫 화면과 랜딩 페이지를 중심으로 검토 예정',
        },
        schema: {
            businessChallenge: '더 믿음직하게 보이기',
            audienceContext: '20-30대 사용자가 금융 앱을 고를 때',
            valueProposition: '세련되고 믿음직한 앱',
            mustAmplify: ['신뢰', '세련됨'],
            scopeNow: '앱 홈',
        },
        expectations: {
            readinessStatus: 'blocked',
            missingFields: ['frameOfReference', 'pointsOfDifference', 'mustAvoid', 'reviewCriteria'],
            weakFields: ['businessChallenge', 'valueProposition', 'mustAmplify', 'scopeNow'],
            priorityGapsInclude: ['피해야 할 방향', '디자인 평가 기준'],
            gapDisplayIncludes: ['먼저 고정할 기준', '피해야 할 방향 누락', '디자인 평가 기준 누락'],
            questionFlow: {
                initialTargetField: 'mustAvoid',
                initialQuestionKind: 'strategy_choice',
                initialQuestionIncludes: ['어떤 인상으로 읽히면 가장 곤란한가요'],
                initialOptionIncludes: ['과장된 광고 인상', '차갑고 거리감 있는 인상'],
                nextTargetFieldAfterFirstChoice: 'mustAmplify',
                nextQuestionKindAfterFirstChoice: 'strategy_choice',
                nextQuestionIncludesAfterFirstChoice: ['가장 먼저 더 강하게 보여줘야 하는 인상'],
            },
        },
    },
    {
        id: 'brand_architecture_blocked_by_conflict',
        label: '브랜드 아키텍처 handoff에서 scope 충돌이 남은 케이스',
        originalFeedback: '마스터브랜드 신뢰는 유지하되 서브브랜드 체계가 완전히 새로워 보였으면 합니다. 다만 로고 변경은 제외입니다.',
        artifactType: 'brand_architecture',
        userContext: {
            industry: 'consumer_tech',
            pricePosition: 'premium',
            projectStage: 'rebranding',
            targetAge: '30s_40s',
            brandDescription: '스마트홈 제품군을 가진 소비자 테크 브랜드',
        },
        schema: {
            businessChallenge: '로고 변경 없이도 서브브랜드 체계를 전면 재정의한 것처럼 느껴지게 만든다.',
            frameOfReference: '마스터브랜드 기반 멀티 제품 브랜드 구조',
            equitiesToProtect: ['마스터브랜드 신뢰감', '제품군 간 공통 체계성'],
            decisionPriority: ['마스터브랜드 신뢰 유지', '라인업 이해 용이성 확보'],
            tradeOffs: ['새롭게 보이되 기존 체계를 알아보지 못할 정도가 되면 안 된다.'],
            mandatories: ['제품군 네이밍 체계는 유지한다.', '온보딩 자료와 제품 패키지에 함께 적용 가능해야 한다.'],
            scope: '로고 변경은 불가지만 브랜드 체계는 전면 재정의 수준으로 새롭게 보여야 한다.',
            scopeNow: '제품군 구조 표기 체계와 패키지 계층 표현을 우선 조정한다.',
            reviewCriteria: ['마스터브랜드 신뢰가 유지되는가', '제품군 간 위계가 더 빨리 이해되는가'],
            mustAvoid: ['마스터브랜드와 완전히 분리된 하우스 오브 브랜드 인상'],
        },
        expectations: {
            readinessStatus: 'blocked',
            contradictionsAtLeast: 1,
            priorityGapsInclude: ['충돌 정리 필요'],
            questionFlow: {
                initialTargetField: 'decisionPriority',
                initialQuestionKind: 'strategy_contradiction',
                initialQuestionIncludes: ['우선순위 충돌이 보입니다', '무엇을 먼저 지켜야 하나요'],
                initialOptionIncludes: ['마스터브랜드 신뢰 유지', '라인업 이해 용이성 확보'],
                nextTargetFieldAfterFirstChoice: 'decisionPriority',
                nextQuestionKindAfterFirstChoice: 'strategy_fill',
                nextQuestionIncludesAfterFirstChoice: ['우선순위 충돌을 해소하려면'],
            },
        },
    },
    {
        id: 'campaign_seed_ready',
        label: '캠페인/크리에이티브 브리프 씨드 ready 케이스',
        originalFeedback: '신제품 런칭 캠페인에서 기능 설명은 유지하되, 성능 자랑보다 일상에서 바로 체감되는 해방감을 더 크게 느끼게 해야 합니다.',
        artifactType: 'campaign_or_creative_brief_seed',
        userContext: {
            industry: 'consumer_electronics',
            pricePosition: 'upper_mid',
            projectStage: 'launch',
            targetAge: '20s_30s',
            brandDescription: '무선 청소기 신제품 런칭',
            additionalContext: '캠페인 키비주얼과 랜딩 페이지, 짧은 영상 스토리보드에 함께 적용',
        },
        schema: {
            businessChallenge: '성능 스펙 중심 인식을 벗어나 사용자의 일상 해방감을 더 크게 느끼게 만든다.',
            audienceContext: '바쁜 20-30대 사용자가 집안일 시간을 줄여주는 제품 가치를 즉시 체감해야 한다.',
            frameOfReference: '프리미엄 생활가전 런칭 캠페인',
            pointsOfDifference: ['성능 자랑보다 생활 해방감을 먼저 전달하는 톤', '제품력 신뢰를 감정 경험 뒤에 자연스럽게 연결하는 구조'],
            valueProposition: '청소 성능보다 생활 여유를 더 직접적으로 체감하게 하는 무선 청소기',
            reasonsToBelieve: ['강한 흡입력', '가벼운 무게', '좁은 공간에서의 사용 편의성'],
            mustAmplify: ['가벼운 해방감', '즉시 체감되는 편의성'],
            mustAvoid: ['기계 스펙 자랑처럼 보이는 톤', '과장된 미래 기술 광고 톤'],
            mandatories: ['캠페인 키비주얼, 랜딩 페이지, 15초 영상에 공통 적용 가능해야 한다.', '제품 컷은 최소 1회 이상 명확하게 노출한다.'],
            decisionPriority: ['사용자 체감 가치 전달', '프리미엄 제품력 신뢰', '스펙 과잉 노출 회피'],
            tradeOffs: ['감성만 강조해 제품력이 약해 보이면 안 된다.'],
            reviewCriteria: ['첫 노출에서 생활 해방감이 먼저 읽히는가', '이후 제품력 신뢰가 자연스럽게 따라오는가'],
            openQuestionsForDesign: ['제품 컷과 라이프스타일 컷의 비중을 어느 정도로 나눌지 실험이 필요한가'],
            scope: '런칭 캠페인 전반',
            scopeNow: '키비주얼, 랜딩 첫 화면, 15초 영상 핵심 컷',
        },
        expectations: {
            readinessStatus: 'ready',
            premiseIncludes: ['일상 해방감'],
            surfaceImplicationsInclude: ['캠페인 메시지', '첫 화면'],
            creativeImplicationsInclude: ['경쟁 대비'],
            designerChecklistInclude: ['생활 해방감', '제품력 신뢰'],
            questionFlow: {
                expectNoQuestion: true,
            },
        },
    },
    {
        id: 'positioning_nogo_only_still_needs_mustavoid',
        label: '운영 no-go만 있어도 mustAvoid 질문은 계속 나와야 하는 케이스',
        originalFeedback: '금융 앱 첫 화면은 손보되 로고는 바꾸지 말아 주세요.',
        artifactType: 'positioning',
        userContext: {
            industry: 'finance',
            pricePosition: 'mid',
            projectStage: 'refresh',
            targetAge: '20s_30s',
            brandDescription: '송금과 소비 관리 기능을 제공하는 금융 앱',
            additionalContext: '앱 첫 화면과 랜딩 페이지를 중심으로 방향을 잡는다',
        },
        schema: {
            businessChallenge: '기존 금융 앱보다 더 믿을 만하고 명확하게 느껴지게 만든다.',
            audienceContext: '금융 앱을 처음 비교하는 20-30대 사용자가 첫 화면에서 신뢰와 이해 용이성을 함께 느껴야 한다.',
            frameOfReference: '간편 금융 앱 시장의 첫 진입 경험',
            pointsOfDifference: ['쉽게 이해되는 첫 화면 구조', '불필요한 과장을 걷어낸 안정감'],
            valueProposition: '복잡하지 않게 믿고 시작할 수 있는 금융 앱',
            mustAmplify: ['브랜드 신뢰감', '이해하기 쉬운 명료함'],
            noGo: ['로고 전면 교체'],
            scopeNow: '앱 첫 화면과 랜딩 첫 화면',
            reviewCriteria: ['첫 인상에서 금융 서비스다운 안정감이 읽히는가', '첫 화면 구조가 과하게 복잡해 보이지 않는가'],
        },
        expectations: {
            readinessStatus: 'needs_clarification',
            missingFields: ['mustAvoid'],
            questionFlow: {
                initialTargetField: 'mustAvoid',
                initialQuestionKind: 'strategy_choice',
                initialQuestionIncludes: ['어떤 인상으로 읽히면 가장 곤란한가요'],
                initialOptionIncludes: ['과장된 광고 인상', '차갑고 거리감 있는 인상'],
            },
            gapDisplayIncludes: ['먼저 고정할 기준', '피해야 할 방향 누락'],
        },
    },
    {
        id: 'brand_platform_strategic_nogo_ready',
        label: '비운영성 no-go가 전략 선으로 보여야 하는 ready 케이스',
        originalFeedback: '브랜드 플랫폼을 다듬되 완전히 다른 카테고리로 넘어간 것처럼 보이면 안 됩니다.',
        artifactType: 'brand_platform',
        userContext: {
            industry: 'wellness',
            pricePosition: 'premium',
            projectStage: 'refresh',
            targetAge: '30s_40s',
            brandDescription: '라이프스타일 웰니스 브랜드',
            additionalContext: '브랜드 소개 화면과 핵심 메시지 구조에 우선 적용',
        },
        schema: {
            businessChallenge: '브랜드 약속이 공허한 선언이 아니라 실제로 믿을 만한 기준처럼 읽히게 만든다.',
            audienceContext: '브랜드를 처음 접하는 30-40대 고객이 소개 화면에서 태도와 신뢰 근거를 함께 이해해야 한다.',
            valueProposition: '웰니스 루틴을 더 현실적으로 지속하게 만드는 브랜드',
            brandPromise: '좋아 보이는 말보다 지속 가능한 생활 기준을 제안한다.',
            principles: ['좋은 말보다 실행 기준을 먼저 보여준다.', '한 줄 메시지와 화면 판단이 직접 연결되어야 한다.'],
            reasonsToBelieve: ['실제 사용자 루틴 데이터', '전문가 자문 기반 콘텐츠 구조', '지속 사용자를 위한 운영 프로그램'],
            mustAmplify: ['브랜드 약속의 선명함', '실행 가능한 현실감'],
            mustAvoid: ['실행과 동떨어진 선언적 톤'],
            noGo: ['브랜드 포지셔닝 자체를 새 카테고리로 이동시키는 전환'],
            scopeNow: '브랜드 소개 첫 화면과 핵심 메시지 구조',
            reviewCriteria: ['브랜드 약속이 한 줄로 바로 읽히는가', '근거가 선언처럼 붕 뜨지 않는가', '기존 브랜드 축이 사라졌다는 느낌이 들지 않는가'],
        },
        expectations: {
            readinessStatus: 'ready',
            translationDisplayIncludes: ['넘으면 안 되는 전략 선', '브랜드 포지셔닝 자체를 새 카테고리로 이동시키는 전환'],
            questionFlow: {
                expectNoQuestion: true,
            },
        },
    },
];
