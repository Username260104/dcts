# Strategy Lane Clarification Plan

## 문서 목적

전략 lane을 "전략 문장 입력 폼"이 아니라, 전략자가 던진 텍스트를 바탕으로 디자이너 입장에서 모호하게 읽힐 지점을 질문으로 좁혀 가는 clarification lane으로 재설계하기 위한 계획 문서다.

이 문서는 현재 코드 기준의 실제 동작 흐름을 먼저 정리하고, 그 구조를 최대한 재사용하는 방향으로 개선 설계를 제안한다.

---

## 1. 현재 전략 lane 실제 흐름

### 1.1 진입과 맥락 입력

- 역할 선택에서 `strategist`를 고르면 `jobType`이 `strategy_to_design_translation`으로 설정된다.
- 전략 lane의 맥락 입력은 다음 4개다.
  - `brandDescription`
  - `positioningNote`
  - `additionalContext`
  - `projectStage`
- 실제 시작 조건은 `projectStage`만 있으면 된다.

관련 코드:

- `src/components/steps/RoleStep.tsx`
- `src/components/steps/ContextStep.tsx`

### 1.2 세션 시작

- `/api/session/start`에서 전략 lane은 클라이언트 lane처럼 후보 브랜치를 좁히지 않는다.
- 곧바로 `extractStrategySchema(feedbackText, context)`를 호출해 입력 텍스트를 구조화된 `StrategyTranslationSchema`로 변환한다.
- 추출 결과는 `StrategyState`로 감싸지고, `readinessStatus`가 `ready`가 아니면 `generateStrategyGapQuestion()`으로 다음 질문을 만든다.

관련 코드:

- `src/app/api/session/start/route.ts`
- `src/lib/llmOrchestrator.ts`

### 1.3 초기 schema 추출

초기 schema 추출은 2단 구조다.

1. heuristic fallback
- `inferStrategyArtifactType()`로 산출물 유형을 대략 추정한다.
- `heuristicStrategySchema()`는 다음 정도만 채운다.
  - 첫 줄을 `businessChallenge`
  - context 자유입력을 이어붙여 `audienceContext`
  - `projectStage`를 이용한 `scope`, `scopeNow`

2. LLM extraction
- `extractStrategySchema()`가 LLM에게 구조화된 schema를 요청한다.
- 실패 시 heuristic 결과로 바로 떨어진다.

핵심 특징:

- 전략 lane의 출발점은 "디자이너가 헷갈리는 해석 후보"가 아니라 "추출된 schema"다.
- 즉 시작부터 판단 흐름이 진단형이다.

### 1.4 readiness 평가

`buildStrategyState()`는 추출된 schema를 다음 네 축으로 평가한다.

- `missingFields`
- `weakFields`
- `contradictions`
- `actionability`

이 평가는 규칙 기반이다.

#### missing

- 산출물 유형별 `requiredFields`에 따라 누락 여부를 판단한다.
- 예를 들어 `positioning`은 `businessChallenge`, `audienceContext`, `frameOfReference`, `pointsOfDifference`, `valueProposition`, `mustAmplify`, `mustAvoid`, `reviewCriteria`가 필수다.

관련 코드:

- `src/lib/strategyArtifacts.ts`

#### weak

- 문자열 필드는 길이와 generic 표현 여부로 본다.
- 리스트 필드는 최소 항목 수와 항목 길이로 본다.
- 예:
  - `businessChallenge`가 너무 짧으면 weak
  - `mustAmplify`가 1개이거나 "세련되게" 수준이면 weak

관련 코드:

- `src/lib/llmOrchestrator.ts` `detectWeakStrategyFields`

#### contradiction

- 다음 같은 경우를 충돌로 본다.
  - `mustAmplify`와 `mustAvoid`가 겹침
  - 프리미엄과 저가/가성비가 동시에 강조됨
  - 로고 변경 불가인데 전면 재정의 수준 요구

관련 코드:

- `src/lib/llmOrchestrator.ts` `detectStrategyContradictions`

#### actionability

- 디자이너가 바로 움직일 수 있는 기준이 있는지 본다.
- 특히 다음을 중요하게 본다.
  - `mustAmplify`
  - `mustAvoid` 또는 `noGo`
  - `scopeNow`
  - `reviewCriteria`

관련 코드:

- `src/lib/llmOrchestrator.ts` `evaluateStrategyActionability`

### 1.5 질문 생성

현재 질문 생성 함수는 `generateStrategyGapQuestion()`이다.

우선순위는 다음과 같다.

1. `artifactType`이 없으면 산출물 유형 질문
2. `contradictions`가 있으면 충돌 해소 질문
3. `missingFields`가 있으면 가장 위험한 누락 field 질문
4. `weakFields`가 있으면 가장 위험한 weak field 질문
5. 없으면 종료

하지만 중요한 문제는 대부분 질문 타입이 `free_text`라는 점이다.

현재 객관식은 사실상 `artifactType` 하나뿐이다.

관련 코드:

- `src/lib/llmOrchestrator.ts`
  - `getNextStrategyTargetField`
  - `getNextStrategyWeakField`
  - `buildStrategyGapQuestion`
  - `buildStrategyQualityWorkflowQuestion`
  - `buildReadableStrategyArtifactQuestion`
  - `buildReadableStrategyContradictionQuestion`

### 1.6 답변 반영

현재 전략 lane의 답변 반영은 `mergeStrategyAnswerIntoState()`가 맡는다.

- `artifactType`는 direction 또는 label을 이용해 구조적으로 반영한다.
- 나머지 field는 대부분 `mergeStrategyFieldValue()`로 바로 들어간다.

여기서 실제 처리는 매우 직접적이다.

- string field는 `trim()`
- list field는 `newline`, `,`, `;`, `/` 기준 split

즉 전략 lane은 질문을 통해 의미를 재해석하는 구조가 아니라, 답변 문자열을 schema에 저장하는 구조다.

관련 코드:

- `src/lib/llmOrchestrator.ts`
  - `normalizeStrategyFieldValue`
  - `splitStrategyList`
  - `mergeStrategyFieldValue`
  - `mergeStrategyAnswerIntoState`

### 1.7 화면 흐름

질문 화면은 클라이언트 lane과 같은 `QuestionsStep`을 재사용한다.

하지만 전략 lane 질문은 대부분 `free_text`라서 실제 UX는 큰 textarea에 문장을 다시 적는 방식으로 수렴한다.

관련 코드:

- `src/components/steps/QuestionsStep.tsx`

### 1.8 중간 진단과 결과

전략 lane은 질문 몇 개를 지나 최종 handoff로 가기 전에 `ConfirmStep`에서 진단형 화면을 보여준다.

- readiness PASS/CHECK
- handoff premise
- core tension
- missing fields
- weak fields
- contradictions
- prioritized gaps

즉 현재 전략 lane은 "대화형 narrowing"보다 "진단 후 보강"에 더 가깝다.

관련 코드:

- `src/components/steps/ConfirmStep.tsx`
- `src/app/api/session/[id]/refine/route.ts`

---

## 2. 현재 구조의 장점

- 이미 `StrategyTranslationSchema`, `StrategyState`, `readiness`, `diagnosis`, `brief generation` 구조가 있다.
- 어떤 항목이 디자이너 handoff에 중요한지 규칙 기반으로 정의돼 있다.
- 전략 lane도 최종적으로 `translation_brief`와 `gap_memo`를 분기할 수 있다.
- 전략 브리프 생성기는 이미 충분히 쓸 만한 출력 구조를 갖고 있다.

즉 버려야 할 것은 적고, 질문부만 바꾸면 된다.

---

## 3. 현재 구조의 핵심 병목

### 3.1 질문이 "해석 분기"를 만들지 못한다

지금 질문은 대부분 "좀 더 구체적으로 적어 주세요"에 가깝다.

하지만 전략 lane의 목적은 전략가가 더 잘 쓰게 만드는 것이 아니라, 디자이너가 오해할 지점을 줄이는 것이다.

따라서 질문은 다음처럼 바뀌어야 한다.

- 지금 문장을 디자이너는 A로 읽을 수도 있고 B로 읽을 수도 있는데, 무엇이 더 맞는가
- 이번 차수에서 더 먼저 지켜야 하는 기준은 무엇인가
- 강화해야 할 인상과 피해야 할 오해 중 어느 쪽이 더 중요하게 고정돼야 하는가

### 3.2 답변 merge가 의미 기반이 아니라 문자열 기반이다

현재는 전략자의 답을 거의 그대로 schema에 저장한다.

이 방식의 문제:

- 디자이너가 판단 가능한 언어로 다시 가공되지 않는다.
- 선택형 질문으로 구조화한 답을 field operation으로 반영할 수 없다.
- 같은 의미가 다른 문장으로 반복 입력될 가능성이 높다.

### 3.3 대화 흐름이 진단 화면에서 끊긴다

지금은 질문 몇 개 후 바로 진단 화면으로 넘어가고, 다시 `보강 질문 더 진행하기`를 눌러야 이어진다.

전략 lane이 clarification lane이 되려면,

- 먼저 2~4개의 핵심 해석 질문을 연속으로 진행하고
- 그 다음 진단 화면을 보여주는 흐름이 더 자연스럽다.

### 3.4 contradiction 해소 답변의 target field가 어색하다

현재 contradiction 질문은 `reviewCriteria`를 target field로 가진다.

하지만 충돌 해소 답변은 보통 다음에 반영돼야 한다.

- `decisionPriority`
- `tradeOffs`
- 경우에 따라 `mustAvoid`

즉 현재 target 설계는 의미상 수정이 필요하다.

---

## 4. 재설계 목표

전략 lane의 목표를 다음처럼 다시 정의한다.

### 4.1 핵심 목표

전략자가 던진 문장을 바탕으로, 디자이너가 오해할 수 있는 지점을 질문으로 좁혀서, 디자인 판단 기준으로 바로 쓸 수 있는 언어로 가공한다.

### 4.2 세부 목표

- 질문은 가능한 한 `choice-first`
- 정말 필요한 경우에만 `free_text`
- 질문은 "누락 field 보강"보다 "해석 ambiguity 제거" 우선
- 답변은 문자열이 아니라 구조화된 판단으로 흡수
- 현재의 `schema`, `readiness`, `brief generation`은 최대한 재사용

### 4.3 비목표

- 전략 문서를 완전히 새로 쓰는 문서 작성 툴이 되지 않는다
- 모든 전략 field를 객관식화하지 않는다
- 클라이언트 lane의 온톨로지 브랜치 선택 로직을 그대로 복제하지 않는다

### 4.4 v1 구현 제약과 전제

현재 코드의 실제 제약을 기준으로 v1 설계를 고정한다.

- `QuestionsStep`은 현재 `text_choice`, `free_text`, `image_ab`만 렌더링한다.
- 전략 lane v1은 새로운 UI 위젯을 만들지 않는다.
- 따라서 `strategy_choice`, `strategy_tradeoff`, `strategy_scope`는 모두 `WorkflowQuestion.type = 'text_choice'`로 구현한다.
- `strategy_fill`만 `WorkflowQuestion.type = 'free_text'`를 사용한다.
- v1에서는 multi-select와 ranking UI를 도입하지 않는다.
- 즉 `scopeNow`, `reviewCriteria`, `mustAmplify`도 한 번에 여러 개를 고르는 것이 아니라, 한 질문당 하나의 primary answer만 고정한다.
- 추가 항목이 필요하면 같은 field에 대해 후속 question 또는 free-text fill로 보강한다.
- v1의 질문 budget은 기존 `MAX_QUESTIONS = 7`을 유지한다.
- 단, 전략 clarification 전용 budget은 내부적으로 `4개의 choice-first 질문 + 최대 2개의 fill 질문`을 목표값으로 둔다.

이 전제를 명시하지 않으면 문서의 질문 설계가 현재 UI와 충돌한다.

---

## 5. 제안하는 새 전략 lane 흐름

```
전략 입력
  -> 초기 schema 추출
  -> ambiguity 진단
  -> 핵심 clarification 질문 2~4개
  -> mid-check
  -> 필요 시 짧은 fill 질문 1~2개
  -> confirm
  -> translation brief 또는 gap memo
```

### 5.1 초기 schema 추출은 유지

`extractStrategySchema()`는 유지한다.

이 단계는 여전히 필요하다.

- 현재 입력을 어떤 artifact로 볼지
- 무엇이 이미 말해졌는지
- 무엇이 비거나 약한지

를 빠르게 파악하는 기본 레이어이기 때문이다.

### 5.2 질문 생성의 초점을 변경

현재:

- missing field를 물음
- weak field를 물음

개선 후:

- 디자이너가 오해할 가능성이 큰 해석 갈림길을 우선적으로 물음
- missing/weak는 그 갈림길을 구성하는 재료로만 사용

예:

- `mustAmplify`가 비었다
  - 기존: "더 강하게 보여야 하는 인상을 적어 주세요"
  - 개선: "이번 차수에서 더 먼저 읽혀야 하는 것은 어느 쪽인가요?"

- `reviewCriteria`가 약하다
  - 기존: "시안 성공 판정 기준을 더 구체적으로 적어 주세요"
  - 개선: "리뷰 때 가장 먼저 통과해야 하는 기준은 무엇인가요?"

### 5.3 질문 타입 추가

전략 lane에 다음 질문 타입을 도입한다.

#### `strategy_choice`

둘 이상의 해석 가설 중 무엇이 더 맞는지 고른다.

예:

- "이번 문장을 디자이너는 이렇게 읽을 수 있습니다. 이번 차수에서 더 먼저 고정돼야 하는 해석은?"
- `[브랜드 신뢰 유지]`
- `[새로운 인상 강화]`
- `[둘 다 중요한데 아직 못 정함]`

구현 타입:

- `WorkflowQuestion.type = 'text_choice'`

#### `strategy_tradeoff`

상충 가능성이 있는 두 기준 중 우선순위를 고른다.

예:

- "둘 다 완전히 가져가기 어렵다면 이번 차수에서 무엇을 먼저 지키나요?"
- `[신뢰 유지]`
- `[세련된 존재감 강화]`

구현 타입:

- `WorkflowQuestion.type = 'text_choice'`

#### `strategy_scope`

이번 차수 적용 범위를 고른다.

예:

- "이번 차수에서 실제로 손대는 범위는 어디까지인가요?"
- `[패키지 전면]`
- `[웹 첫 화면]`
- `[상세페이지 핵심 구간]`
- `[브랜드 전체는 아님]`

구현 타입:

- `WorkflowQuestion.type = 'text_choice'`

v1 제한:

- 복수 선택이 아니라 "이번 차수에서 우선 고정해야 하는 primary surface"를 묻는다.
- 여러 표면을 모두 고정해야 하면 후속 fill 질문에서 문장으로 보강한다.

#### `strategy_fill`

선택지로 더는 좁히기 어렵거나 전략가 고유 언어가 꼭 필요할 때만 사용한다.

예:

- "방금 고른 우선순위를 한 문장으로 적어 주세요."

구현 타입:

- `WorkflowQuestion.type = 'free_text'`

### 5.4 선택지 생성 규칙 v1

선택지는 즉흥적으로 만들지 않고 아래 우선순위로 생성한다.

1. 현재 `strategyState.schema`에 이미 들어 있는 표현
2. `strategyState.diagnosis`에서 뽑을 수 있는 표현
3. `userContext`에 들어 있는 명시 표현
4. field별 기본 choice library
5. 그래도 2개 이상 못 만들면 `strategy_fill`

예:

- `mustAvoid`
  - schema.mustAvoid, schema.noGo에서 후보 추출
  - diagnosis.coreTension의 부정 표현 추출
  - userContext.additionalContext에서 회피 표현 추출
  - 부족하면 기본 라이브러리 사용

- `decisionPriority`
  - schema.decisionPriority 우선 사용
  - contradiction 문장에서 충돌 당사자 추출
  - userContext.positioningNote에서 대립 표현 추출
  - 부족하면 기본 라이브러리 사용

field별 기본 choice library는 새 파일로 분리한다.

- 제안 파일: `src/lib/strategyChoiceLibrary.ts`

선택지 생성 시 규칙:

- 실제 옵션은 2~3개만 노출
- 마지막 옵션은 항상 아래 둘 중 하나다
  - `잘 모르겠어요`
  - `직접 적기`
- 의미가 지나치게 겹치는 옵션은 제거
- 옵션 문구는 디자이너가 읽는 최종 브리프 문장이 아니라, 전략자가 판단하기 쉬운 수준의 문장으로 만든다

---

## 6. 1차 적용 대상 field

처음부터 모든 field를 choice-first로 바꾸기보다, 디자이너 수정 리소스와 직접 연결되는 항목부터 적용한다.

1차 적용 권장 field:

- `mustAmplify`
- `mustAvoid`
- `decisionPriority`
- `scopeNow`
- `reviewCriteria`

이유:

- `evaluateStrategyActionability()`에서 이미 중요하게 보는 항목이다.
- 디자이너가 실제 시안에서 가장 먼저 판단하는 항목이다.
- 주관식으로 두었을 때 모호함이 크게 남는다.

---

## 7. 필드별 질문 설계안 v1

### 7.1 `mustAmplify`

목적:

- 이번 차수에서 더 강하게 읽혀야 할 인상을 고정

질문 예시:

- "이번 차수에서 더 먼저 강해져야 하는 인상은 어느 쪽인가요?"
- `[신뢰감이 더 선명해야 함]`
- `[세련된 존재감이 더 강해야 함]`
- `[친근한 온도감이 더 살아야 함]`
- `[직접 적기]`

답변 반영:

- 선택형이면 primary signal 하나를 `mustAmplify`에 append
- `직접 적기`면 `strategy_fill`

v1 보강 규칙:

- 이 답변 후에도 `mustAmplify`가 weak로 남고 질문 budget이 남아 있으면 한 번 더 보강 질문 가능
- 같은 field를 2회 이상 반복하지 않는다

### 7.2 `mustAvoid`

목적:

- 디자이너가 넘어가기 쉬운 오해 금지선 고정

질문 예시:

- "이번 방향이 무엇처럼 보이면 가장 곤란한가요?"
- `[차갑고 병원 같은 인상]`
- `[거리감 있는 럭셔리 인상]`
- `[너무 대중적이고 가벼운 인상]`
- `[직접 적기]`

답변 반영:

- 선택형이면 primary no-go 하나를 `mustAvoid`에 append

### 7.3 `decisionPriority`

목적:

- 상충 시 우선순위 고정

질문 예시:

- "둘 다 완전히 가져가기 어렵다면 이번 차수에서 무엇을 먼저 지키나요?"
- `[브랜드 신뢰 유지]`
- `[새로운 인상 강화]`
- `[일관성 유지]`
- `[직접 적기]`

답변 반영:

- 선택형이면 `decisionPriority` append

### 7.4 `scopeNow`

목적:

- 이번 차수의 실제 수정 범위 명확화

질문 예시:

- "이번 차수에서 실제로 판단을 맞춰야 하는 표면은 어디인가요?"
- `[패키지 전면]`
- `[웹 첫 화면]`
- `[상세페이지 핵심 구간]`
- `[브랜드 전체 가이드 아님]`
- `[직접 적기]`

답변 반영:

- 선택형이면 primary scope를 `scopeNow`에 set
- 추가 범위가 필요하면 후속 fill 질문에서 보강

### 7.5 `reviewCriteria`

목적:

- 디자인 리뷰 통과 기준 고정

질문 예시:

- "리뷰 때 가장 먼저 통과해야 하는 기준은 무엇인가요?"
- `[첫 인상에서 의도한 인식이 읽히는가]`
- `[기존 고객이 낯설지 않게 받아들이는가]`
- `[채널 간 방향이 일관되게 유지되는가]`
- `[직접 적기]`

답변 반영:

- 선택형이면 primary review criterion 하나를 `reviewCriteria`에 append
- 아직 weak면 후속 fill 질문으로 두 번째 기준을 보강

---

## 8. 질문 생성 우선순위 재정의

새 전략 lane의 질문 우선순위는 아래처럼 바꾼다.

1. `artifactType` 미정
2. contradiction 해소
3. `decisionPriority` 고정
4. `mustAvoid` 고정
5. `mustAmplify` 고정
6. `scopeNow` 고정
7. `reviewCriteria` 고정
8. 그 외 weak/missing field를 필요 시 fill

이 순서는 "디자이너가 틀리기 쉬운 기준"을 먼저 고정하는 순서다.

---

## 9. 답변 반영 방식 개선

현재는 raw string을 field에 그대로 넣는다.

개선 후에는 `selectedDirection`을 operation처럼 사용한다.

문자열 포맷은 v1에서 아래처럼 고정한다.

`op|field|value`

파싱 규칙:

- 첫 번째 `|` 전은 operation
- 두 번째 `|` 전은 target field
- 나머지 전체는 value

이 포맷을 쓰는 이유:

- value 안에 `:`가 자연스럽게 들어갈 수 있다
- 기존 `LLMQuestionOption.direction`이 string 하나만 받기 때문에 추가 타입 확장 없이 바로 실을 수 있다
- 첫 두 개의 구분자 위치만 찾고, 나머지 문자열 전체를 value로 보관하는 방식으로 안정적으로 파싱할 수 있다

권장 파서:

- 첫 번째 `|` 위치를 찾는다
- 두 번째 `|` 위치를 찾는다
- `operation = slice(0, firstPipeIndex)`
- `field = slice(firstPipeIndex + 1, secondPipeIndex)`
- `value = slice(secondPipeIndex + 1)`

예시:

- `set|decisionPriority|브랜드 신뢰 유지`
- `append|mustAvoid|차갑고 병원 같은 인상`
- `append|mustAmplify|세련된 존재감`
- `set|scopeNow|패키지 전면`
- `append|reviewCriteria|첫 인상에서 의도한 인식이 읽히는가`
- `fallback|mustAvoid|free_text`
- `noop|decisionPriority|unclear`

이 구조를 쓰면 `mergeStrategyAnswerIntoState()`가 아래처럼 바뀔 수 있다.

- 선택형 답변은 operation을 해석해 정확한 field에 반영
- `직접 적기`일 때만 현재의 free text merge 사용

### 9.1 `직접 적기` 처리 방식

`직접 적기`는 inline textarea를 열지 않고, 다음 질문으로 전환한다.

구체 흐름:

1. 전략 choice question에서 사용자가 `직접 적기` 선택
2. `selectedDirection = fallback|{field}|free_text`
3. `mergeStrategyAnswerIntoState()`는 이 값을 보고 schema를 즉시 수정하지 않음
4. 대신 같은 `targetField`를 가진 `strategy_fill` 질문을 다음 질문으로 반환
5. 그 free-text 답변이 들어오면 그때만 현재의 raw text merge 로직을 사용

이 방식이면 현재 `QuestionsStep` 구조를 바꾸지 않고도 선택형 -> 자유입력 fallback 전이가 가능하다.

### 9.2 반복 질문 방지 규칙

현재 `askedFields`는 존재하지만 실제 질문 선택에 적극 사용되지 않는다.

v1에서는 아래 규칙을 추가한다.

- 같은 field에 대한 choice-first 질문은 최대 1회
- 같은 field의 fill 질문은 최대 1회
- 즉 한 field당 최대 2회까지 허용
- 2회 이후에도 unresolved면 confirm으로 보내고 `gap memo`에서 남은 ambiguity를 노출

이를 위해 `StrategyState`에 아래 필드를 추가한다.

- `askedFieldCounts?: Partial<Record<StrategyFieldKey | 'artifactType', number>>`

질문 선택 시 `askedFieldCounts`를 참고해 무한 반복을 방지한다.

### 9.3 contradiction 질문 target 정정

현재 contradiction 질문은 `reviewCriteria`를 target으로 가진다.

개선 후:

- 기본 target은 `decisionPriority`
- 필요 시 `tradeOffs`

로 바꾼다.

---

## 10. 필요한 타입/메타 확장

### 10.1 `questionKind` 확장

현재 전략 관련 questionKind:

- `strategy_gap`
- `strategy_contradiction`
- `strategy_quality`

추가 제안:

- `strategy_choice`
- `strategy_tradeoff`
- `strategy_scope`
- `strategy_fill`

### 10.2 `WorkflowQuestionMeta` 확장

질문 메타에 아래 정보를 추가하는 것을 권장한다.

- `operationMode`: `set | append | clarify`
- `suggestedValues`: string[]
- `fallbackToFreeText`: boolean

이 정보가 있으면 질문 렌더링과 merge가 더 명확해진다.

### 10.3 `StrategyState` 확장

질문 반복 제어를 위해 아래 필드를 추가한다.

- `askedFieldCounts?: Partial<Record<StrategyFieldKey | 'artifactType', number>>`

기존 `askedFields`, `lastAskedField`는 유지하되 역할을 분리한다.

- `askedFields`: 어떤 field를 한 번이라도 건드렸는지 기록
- `askedFieldCounts`: 해당 field를 몇 번 질문했는지 기록
- `lastAskedField`: 바로 직전 question의 field

구현 주의:

- `buildStrategyState()`에서 `previousState?.askedFieldCounts ?? {}`를 반드시 이어받아야 한다.
- 그렇지 않으면 매 답변마다 count가 초기화되어 반복 질문 방지 규칙이 깨진다.

---

## 11. 화면 흐름 개선

현재는 진단 화면에서 한번 멈춘다.

개선 제안:

- 세션 시작 후 바로 2~4개의 핵심 clarification 질문 진행
- 그 다음 `ConfirmStep`에서 진단형 요약 노출
- `보강 질문 더 진행하기`는 남겨 두되, 2차 refinement 용도로만 사용

이렇게 하면 전략 lane도 클라이언트 lane처럼 "질문으로 해상도를 올린다"는 경험이 생긴다.

### 11.1 confirm 진입 조건 v1

confirm으로 보내는 조건을 아래처럼 고정한다.

1. contradiction가 해소되었고
2. 아래 core field가 모두 채워졌거나 더 이상 choice 질문을 만들 수 없을 때
   - `decisionPriority`
   - `mustAvoid`
   - `mustAmplify`
   - `scopeNow`
   - `reviewCriteria`
3. 또는 strategy question count가 6에 도달했을 때

즉 v1에서는 모든 required field를 질문으로 다 채우려 하지 않고, 디자이너 handoff에 가장 직접적인 core field를 우선 고정한 뒤 confirm으로 보낸다.

구현 주의:

- 현재 `handleStrategyAnswer()`는 `MAX_QUESTIONS`를 기준으로 다음 질문 생성을 끊는다.
- v1 문서안의 `6개 내외` 규칙을 실제로 적용하려면 전략 lane 전용 상수 예: `STRATEGY_CLARIFICATION_MAX = 6`를 두고 route에서 함께 사용해야 한다.
- 그렇지 않으면 문서상 흐름과 런타임 종료 시점이 어긋난다.

---

## 12. 구현 단계 제안

### Phase A. 질문 타입 확장

대상:

- `src/types/ontology.ts`
- `src/lib/llmOrchestrator.ts`

작업:

- 전략 lane용 choice-first questionKind 추가
- `WorkflowQuestionMeta` 확장
- `StrategyState.askedFieldCounts` 추가

### Phase B. 질문 생성기 교체

대상:

- `src/lib/llmOrchestrator.ts`

작업:

- `generateStrategyGapQuestion()`를 ambiguity-first 질문기로 변경
- `generateStrategyGapQuestion()` 내부에 confirm stop condition 반영
  - contradiction 해소 + core field 고정 완료
  - 같은 field 재질문 한도 초과
  - 전략 lane 전용 budget 소진
- field별 choice templates 작성
- `strategyChoiceLibrary.ts` 추가
- choice 생성 실패 시 `strategy_fill`로 안전하게 fallback

### Phase C. 답변 merge 개선

대상:

- `src/lib/llmOrchestrator.ts`
- `src/app/api/session/[id]/answer/route.ts`

작업:

- `selectedDirection` operation 파싱
- 선택형 답변을 schema operation으로 반영
- contradiction target 수정
- `fallback|field|free_text` 전이 처리
- `askedFieldCounts` 갱신

### Phase D. 화면 경험 조정

대상:

- `src/components/steps/QuestionsStep.tsx`
- `src/components/steps/ConfirmStep.tsx`

작업:

- 전략 lane question summary 보조 문구 조정
- 진단 화면 진입 시점 조정
- `QuestionsStep` 자체는 최대한 유지하고 copy만 보정

### Phase E. 품질 검증

대상:

- `src/lib/strategyFixtures.ts`
- 신규 fixture 추가

검증 포인트:

- 추상 전략 문장에서 clarification 질문이 제대로 나오는가
- 선택형 답변 후 `mustAmplify`, `mustAvoid`, `decisionPriority`, `scopeNow`, `reviewCriteria`가 의도대로 반영되는가
- 결과 브리프가 디자이너 관점에서 더 판단 가능해졌는가
- 같은 field가 무한 반복되지 않는가
- `직접 적기` 선택 시 올바른 free-text fallback으로 전환되는가
- single-select UI 제약 안에서 질문 흐름이 자연스럽게 유지되는가

---

## 13. 성공 기준

전략 lane 개선이 성공했다고 보려면 아래가 충족돼야 한다.

- 전략 lane 질문의 절반 이상이 객관식 또는 선택형으로 전환된다.
- 전략 lane 사용자가 "다시 써야 한다"는 느낌보다 "해석을 고른다"는 느낌을 받는다.
- 최종 `translation_brief`에서 다음 5개가 더 자주 채워진다.
  - `mustAmplify`
  - `mustAvoid`
  - `decisionPriority`
  - `scopeNow`
  - `reviewCriteria`
- `gap_memo`로 떨어지는 비율이 줄어들더라도, quality가 낮아져서는 안 된다.
- 디자이너가 브리프만 보고 "무엇을 더 세게 밀고, 무엇을 피하고, 어디까지 손대야 하는지"를 바로 이해할 수 있어야 한다.

---

## 14. 최종 판단

현재 전략 lane의 본체는 버릴 필요가 없다.

유지할 것:

- schema 추출
- readiness 평가
- diagnosis
- brief generation
- gap memo 생성

바꿔야 할 것:

- 질문 생성 방식
- 답변 merge 방식
- 중간 흐름의 대화성

즉 전략 lane은 "전략 문장 입력기"에서 "디자인 handoff clarification engine"으로 이동해야 한다.

핵심 변화 한 줄 요약:

`무엇이 비었는가를 묻는 lane`에서 `디자이너가 어디서 오해할지를 좁히는 lane`으로 전환한다.
