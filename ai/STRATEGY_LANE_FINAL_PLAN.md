# Strategy Lane Final Plan

## 문서 목적

이 문서는 `STRATEGY_LANE_CLARIFICATION_PLAN.md`를 한 번 더 재검토한 뒤, 실제 구현 우선순위와 산출물 기준까지 고정하기 위한 최종 실행 문서다.

이전 문서가 "전략 lane을 clarification lane으로 바꿔야 한다"는 문제의식을 정리했다면, 이 문서는 그 방향을 유지한 채 아래 세 가지를 최종적으로 결정한다.

- 무엇을 유지할 것인가
- 무엇을 먼저 바꿔야 하는가
- 어떤 상태가 되면 개선이 성공했다고 볼 것인가

이 문서는 현재 코드 기준의 실제 동작과 샘플 출력 확인을 반영한 결론이다.

---

## 1. 최종 결론

전략 lane의 핵심 문제는 더 이상 "질문이 너무 free-text다"에만 있지 않다.

현재 구현은 이미 일부 핵심 질문을 `choice-first`로 전환했다. 실제로 `mustAmplify`, `mustAvoid`, `decisionPriority`, `scopeNow`, `reviewCriteria`는 전략자가 다시 긴 문장을 쓰기보다 해석을 고르는 흐름으로 개선되고 있다.

하지만 최종 `전략-디자인 번역 브리프`는 여전히 디자이너 관점의 작업 문서라기보다 내부 schema와 diagnosis를 나열한 문서에 가깝다.

즉 현재의 병목은 아래 순서로 정리된다.

1. 질문 생성의 문제
2. 답변 merge의 문제
3. 최종 브리프 정보 구조의 문제

이 중 가장 큰 병목은 3번이다.

따라서 최종 우선순위는 다음처럼 고정한다.

1. 브리프 구조 재설계
2. gap memo 구조 재설계
3. 질문/선택지 정교화
4. 문장 품질과 중복 제거

한 줄로 요약하면:

`전략 lane은 이미 clarification 쪽으로 이동 중이지만, 최종 브리프가 아직 디자이너용 handoff 문서로 완전히 번역되지 않았다.`

---

## 2. 현재 상태 재평가

### 2.1 유지해야 하는 것

아래 구조는 버리지 않는다.

- `StrategyTranslationSchema`
- `StrategyState`
- `readiness` 평가
- `diagnosis`
- `translation_brief / gap_memo` 분기
- branch mapping

이 레이어들은 내부 판단 엔진으로서 충분히 유효하다.
문제는 이 내부 구조를 거의 그대로 최종 브리프에 노출하고 있다는 점이다.

### 2.2 이미 좋아진 부분

- 핵심 질문이 "field를 채워라"보다 "무엇을 먼저 고정할지 고르라"는 방향으로 일부 전환됐다.
- `strategyChoiceLibrary`가 생기면서 핵심 field를 객관식 중심으로 좁히는 흐름이 마련됐다.
- contradiction 대응이 `decisionPriority` 중심으로 이동했다.
- `askedFieldCounts`로 같은 field를 무한 반복하지 않는 기본 안전장치가 생겼다.

즉 질문 레이어는 이전 문서의 방향성과 꽤 일치한다.

### 2.3 지금 가장 크게 남아 있는 문제

#### A. 최종 브리프가 schema 중심으로 읽힌다

현재 문서 구조는 대체로 아래 흐름이다.

- Shared Handoff
- Decision Rules
- Strategy Rationale
- Direction Mapping
- Open Risks

이 순서는 내부 설계 관점에서는 자연스럽지만, 디자이너 입장에서는 다음 질문으로 다시 번역해야 한다.

- 그래서 이번 시안에서 뭘 먼저 세게 밀라는 건가
- 무엇처럼 보이면 실패인가
- 어디까지 손대라는 건가
- 무엇은 건드리면 안 되는가
- 리뷰 때 무엇으로 통과를 판단하나

즉 현재 문서는 "전략을 설명"하지만, 디자이너가 "바로 판단"하기는 어렵다.

#### B. 서로 다른 층위의 정보가 섞인다

현재 구조에서는 아래 항목들이 쉽게 한 덩어리로 읽힌다.

- `mustAvoid`
- `noGo`
- `equitiesToProtect`
- `mandatories`

하지만 실제 의미는 완전히 다르다.

- `mustAvoid`: 결과물이 어떤 인상으로 읽히면 안 되는가
- `noGo`: 실제로 하면 안 되는 변경
- `equitiesToProtect`: 유지해야 할 자산
- `mandatories`: 반드시 반영해야 할 운영/구성 요소

이 네 항목은 디자이너가 서로 다른 판단 순간에 참조하는 정보다.
같은 블록이나 비슷한 계층으로 보이면 직관성이 떨어진다.

#### C. 같은 뜻의 정보가 여러 번 반복된다

현재 출력에서는 아래 항목들이 의미상 서로 겹친다.

- `strategicPremise`
- `decisionFrame`
- `creativeImplications`
- `reviewCriteria`
- `designerChecklist`

정보량은 많아 보이지만, 실제로는 같은 판단 기준이 다른 문장 형태로 반복되기 쉽다.

그 결과 디자이너는 "정보가 충분하다"보다 "비슷한 말이 많다"는 인상을 받게 된다.

#### D. 문장 합성 품질이 아직 handoff 문서 수준이 아니다

현재 합성 문장에는 다음 종류의 문제가 남아 있다.

- 조사 결합이 어색함
- 종결 문장이 기계적으로 이어짐
- 같은 문장 안에 서로 다른 문체가 섞임
- list 항목이 문장 안에서 부자연스럽게 연결됨

이 문제는 내용 정확도와 별개로 신뢰감을 낮춘다.
전략 문서를 "기계가 대충 묶은 결과"처럼 보이게 만들 수 있다.

#### E. gap memo가 아직도 field 진단 문법에 가깝다

현재 gap memo는 다음 표현에 머무르는 경향이 있다.

- missing criteria
- weak criteria
- 더 구체적으로 확인해 주세요

이 표현은 내부 QA에는 유용하지만, handoff 관점에서는 아직 "왜 지금 넘기면 위험한지"가 덜 선명하다.

gap memo 역시 디자이너 오해 가능성을 중심으로 재작성되어야 한다.

---

## 3. 최종 목표 정의

전략 lane의 최종 목적은 전략자가 더 긴 문장을 쓰게 만드는 것이 아니다.

최종 목적은 아래 두 문장으로 정리한다.

- 전략자는 "해석을 고르고 우선순위를 고정하는 사람"이 되어야 한다.
- 디자이너는 브리프만 읽고 "무엇을 밀고, 무엇을 피하고, 어디까지 손대야 하는지"를 즉시 이해해야 한다.

이 목표를 더 실무적으로 풀면, 디자이너는 브리프를 읽고 30초 안에 아래 다섯 가지를 말할 수 있어야 한다.

1. 이번 시안의 한 줄 미션
2. 먼저 강해져야 할 인상
3. 이렇게 보이면 실패라는 금지선
4. 이번 차수에서 실제로 맞춰야 할 범위
5. 리뷰 통과 기준

---

## 4. 최종 정보 구조

최종 `translation_brief`는 더 이상 내부 schema를 순서대로 노출하지 않는다.
대신 디자이너의 판단 순서에 맞춘 문서 구조를 사용한다.

### 4.1 기본 원칙

- 가장 먼저 보여줄 것은 `설명`이 아니라 `판단 기준`
- 전략적 배경은 본문 후반 또는 접을 수 있는 보조 정보로 이동
- 같은 뜻의 정보는 한 번만 등장
- 영문 섹션명을 기본값으로 사용하지 않음
- `Decision Trail`은 1차 본문이 아니라 부가 설명으로 취급

### 4.2 권장 최종 섹션

#### 1. 이번 시안의 한 줄 미션

- 지금 결과물이 무엇을 달성해야 하는지 한 줄로 고정
- 현재 `strategicPremise`를 더 짧고 더 판단 가능하게 축약한 형태

#### 2. 먼저 강해져야 할 것

- `mustAmplify`
- 필요하면 2개까지 허용
- 디자이너가 첫 시안에서 과감하게 밀어야 할 핵심 인상

#### 3. 이렇게 보이면 실패

- `mustAvoid`
- 인상 차원의 금지선
- "실수로 넘어가기 쉬운 오해"가 드러나야 함

#### 4. 이번 차수에서 실제로 맞춰야 할 범위

- `scopeNow`
- 이번 리뷰의 primary surface
- 패키지, 웹 첫 화면, 상세페이지 핵심 구간처럼 실제 시안 단위로 읽혀야 함

#### 5. 지켜야 할 자산

- `equitiesToProtect`
- 이번 수정이 있어도 유지돼야 할 브랜드 인식 또는 식별 자산

#### 6. 건드리면 안 되는 것

- `noGo`
- 운영/변경 금지선
- `mustAvoid`와 절대 합치지 않음

#### 7. 리뷰 통과 기준

- `reviewCriteria`
- 최대 3개
- "좋아 보이는가"가 아니라 "무엇이 읽히면 통과인가" 형태여야 함

#### 8. 표면별 적용 메모

- `surfaceImplications`
- 실제 작업 화면이나 산출물에 어떻게 번역되는지
- 디자이너에게 가장 직접적인 실행 메모

#### 9. 왜 이 방향이 맞는가

- `frameOfReference`
- `valueProposition`
- `reasonsToBelieve`
- `pointsOfDifference`

이 섹션은 전략 설명용이다.
중요하지만 본문 전반부가 아니라 후반부에 둔다.

#### 10. 아직 가정인 것

- `workingAssumptions`
- 사실로 확정되지 않은 항목만 별도 명시
- 이 섹션은 brief의 겸손함과 정확성을 높인다

#### 11. 참고할 무드 / 피할 무드

- `recommendedDirections`
- `avoidedDirections`
- 다만 branch 이름만 보여주는 것이 아니라, 왜 추천/회피되는지 짧게 번역해야 한다

### 4.3 본문에서 제외하거나 2차화할 것

- `confirmedInputs`는 기본 본문 1차 노출이 아니라 접을 수 있는 참고 정보로 이동
- `decisionTrail`은 appendix 또는 details 영역으로 이동
- `decisionFrame`과 `designerChecklist`는 독립 섹션이 아니라 상위 섹션으로 흡수

이 둘은 내부 생성엔 유용하지만, 최종 handoff 본문에서는 중복도를 높이기 쉽다.

---

## 5. 질문 설계 최종 방향

질문 레이어는 폐기하지 않는다.
다만 "잘 바뀐 부분은 유지하고, 어색한 부분만 정교화"하는 방향으로 마무리한다.

### 5.1 유지할 원칙

- `choice-first`
- 정말 필요할 때만 `free_text`
- "field를 채우는 질문"보다 "오해 갈림길을 고르는 질문"
- 한 field당 최대 2회 이내

### 5.2 더 다듬어야 하는 질문

#### `decisionPriority`

현재도 중요하지만, 기본값 후보가 다소 일반적이다.
앞으로는 아래 순서로 더 강하게 좁혀야 한다.

- 현재 contradiction 당사자
- `equitiesToProtect` vs `mustAmplify`
- `reviewCriteria`와 충돌하는 실제 선택

즉 `브랜드 신뢰 유지 / 새로운 인상 강화 / 정보 전달 명확성` 같은 일반 선택지만으로 끝나면 안 된다.
가능하면 현재 입력 안의 실제 긴장을 그대로 선택지로 만들어야 한다.

#### `scopeNow`

현재는 표면 범위를 묻지만, 앞으로는 "이번 리뷰에서 먼저 맞출 표면"을 더 명확히 드러내야 한다.

예:

- 패키지 전면
- 웹 첫 화면
- 상세페이지 핵심 구간
- 시스템 전체가 아니라 대표 화면

범위를 넓히는 질문이 아니라, 지금 무엇을 먼저 맞추는지 고정하는 질문이어야 한다.

#### `reviewCriteria`

현재도 중요한 field이지만, 질문 톤은 더 리뷰 순간 중심이어야 한다.

예:

- 첫 인상 3초 안에 무엇이 읽히면 통과인가
- 기존 고객이 낯설다고 느끼지 않으면 통과인가
- 채널 간 톤이 일관되면 통과인가

즉 "평가 기준"보다 "리뷰 자리에서 무엇을 보면 됐다고 말할 수 있나"의 언어가 더 적합하다.

### 5.3 선택지 라이브러리 개선 원칙

`strategyChoiceLibrary`는 유지하되, 아래 방향으로 확장한다.

- field별 범용 기본값 유지
- `artifactType`별 우선 선택지 분화
- `scopeNow`는 surface vocabulary를 더 직접적으로 사용
- `mustAvoid`는 실제 오해 인상 중심으로, 운영 금지선과 분리
- `reviewCriteria`는 추상 명사보다 관찰 가능한 판정 문장으로 구성

선택지는 "예쁜 문장"보다 "빠르게 판단 가능한 문장"이 우선이다.

---

## 6. gap memo 최종 방향

gap memo는 더 이상 "부족한 field 목록"처럼 읽혀서는 안 된다.

최종적으로는 아래 질문에 답하는 문서가 되어야 한다.

- 지금 이 상태로 handoff하면 디자이너가 무엇을 오해할 가능성이 큰가
- 무엇이 아직 고정되지 않아서 시안 판단이 흔들릴 수 있는가
- 다음에 무엇부터 확인하면 바로 handoff 가능한가

### 6.1 권장 섹션

#### 1. 현재까지 고정된 판단

- 지금까지는 무엇이 분명한가

#### 2. 아직 헷갈리는 갈림길

- 현재 ambiguity를 field가 아니라 해석 갈림길 언어로 표현

#### 3. 지금 넘기면 생길 오해

- 왜 바로 handoff 하면 위험한지
- 디자이너가 잘못 밀 가능성이 있는 방향을 명시

#### 4. 다음에 먼저 확인할 3개

- 질문을 많이 던지는 대신, 우선순위가 높은 확인 포인트만 남김

#### 5. 현재 가정으로 두는 것

- 확정되지 않았지만 임시로 두는 전제

### 6.2 버리거나 약화할 표현

- `Missing Criteria`
- `Weak Criteria`
- `Priority Gaps`
- `Next Questions`

이런 내부 QA 용어는 사용자 노출 문구로는 적합하지 않다.

---

## 7. 구현 전략

이번 개선은 "렌더 구조만 바꾸는 작업"으로 끝내지 않는다.
내부 intermediate model과 사용자 노출 model을 분리하는 방향으로 간다.

### 7.1 핵심 결정

`StrategyTranslationBrief`는 내부 생성 결과로 유지한다.
하지만 UI와 PDF는 이 객체를 거의 그대로 렌더링하지 않는다.

대신 아래 성격의 presentation model을 별도로 만든다.

- machine-facing brief
- designer-facing brief view model

즉 내부 추론 레이어와 최종 handoff 레이어를 분리한다.

### 7.2 새로 필요한 레이어

권장 추가 구조:

- `StrategyDesignerHandoffView`
- `StrategyGapMemoView`

이 view model은 다음 역할을 맡는다.

- 중복 정보 제거
- `mustAvoid`와 `noGo` 분리
- 섹션별 우선순위 재배열
- 불필요하게 긴 문장 축약
- 문장 품질 보정

이렇게 하면 `BriefDocument`와 `briefExport`가 내부 schema를 직접 해석하지 않아도 된다.

### 7.3 구현 순서

#### Phase 1. presentation model 도입

- `strategyPipeline` 또는 별도 presenter 파일에서 최종 노출용 model 생성
- 현재 `translationBrief`는 그대로 유지

#### Phase 2. 브리프 렌더 구조 교체

- `BriefDocument.tsx`
- `briefExport.ts`

위 두 곳을 같은 정보 구조로 맞춘다.
웹과 PDF의 섹션 순서가 달라지지 않게 한다.

#### Phase 3. gap memo 렌더 구조 교체

- field 진단형 문구를 사용자 언어로 바꾼다
- 왜 지금 handoff 하면 위험한지를 더 직접적으로 보여준다

#### Phase 4. 질문과 choice library 재정비

- `decisionPriority`
- `scopeNow`
- `reviewCriteria`

이 세 가지를 우선 정교화한다.

#### Phase 5. 텍스트 품질 보정

- 조사/어미 정리
- list 결합 품질 개선
- 중복 표현 제거

---

## 8. 파일별 작업 범위

### 필수 변경

- `src/types/ontology.ts`
- `src/lib/strategyPipeline.ts`
- `src/app/api/brief/[id]/generate/route.ts`
- `src/components/brief/BriefDocument.tsx`
- `src/lib/briefExport.ts`

### 후속 변경

- `src/lib/strategyChoiceLibrary.ts`
- `src/lib/llmOrchestrator.ts`
- `src/lib/strategyFixtures.ts`
- `ai/runStrategyFixtures.ts`

### 가능하면 분리할 파일

- `src/lib/strategyBriefPresenter.ts`

이 파일이 있으면 pipeline과 presentation 로직이 덜 엉킨다.

---

## 9. 명시적으로 결정한 것

이번 최종 계획에서 아래 사항을 명시적으로 결정한다.

### 유지

- schema 추출 구조
- readiness 구조
- contradiction 감지 구조
- branch mapping 구조
- 질문-응답 기반 clarification 흐름

### 변경

- 최종 브리프 섹션 구조
- gap memo 문구와 정보 구조
- 최종 노출용 문장 합성 방식
- 추천/회피 방향의 노출 문법

### 이번 범위에서 하지 않음

- 새로운 multi-select UI 도입
- 전략 lane 전용 복잡한 새 위젯 도입
- 온톨로지 체계 자체 재작성
- 브랜치 시스템 전면 교체

---

## 10. 성공 기준

전략 lane 개선이 성공했다고 보려면 아래가 충족돼야 한다.

### 사용자 경험 기준

- 전략자는 "다시 전략 문서를 써야 한다"보다 "해석을 고정한다"는 느낌을 받는다.
- 디자이너는 브리프만 읽고 아래 다섯 가지를 바로 이해할 수 있다.
  - 한 줄 미션
  - 먼저 밀 것
  - 실패 인상
  - 이번 차수 범위
  - 리뷰 통과 기준

### 문서 품질 기준

- 최종 브리프의 핵심 섹션은 한국어 중심의 디자이너 언어로 정리된다.
- 같은 의미가 3개 이상의 섹션에서 반복되지 않는다.
- `mustAvoid`와 `noGo`가 본문에서 분리되어 보인다.
- `Decision Trail`은 부가 정보로만 남는다.

### 로직 기준

- 핵심 field 5개가 지금보다 더 자주 채워진다.
  - `mustAmplify`
  - `mustAvoid`
  - `decisionPriority`
  - `scopeNow`
  - `reviewCriteria`
- 질문이 같은 field를 과하게 반복하지 않는다.
- gap memo로 떨어질 때도 "왜 아직 handoff 하기 어려운지"가 더 명확해진다.

### 텍스트 품질 기준

- 조사 결합 오류와 부자연스러운 종결 문장이 눈에 띄게 줄어든다.
- list에서 문장을 조립할 때 어색한 접합이 줄어든다.
- 샘플 fixture 기준으로 읽기 흐름이 자연스러워진다.

---

## 11. 최종 판단

이제 전략 lane의 다음 단계는 질문 엔진만 더 손보는 것이 아니다.

정확한 방향은 아래와 같다.

- 내부 판단 구조는 유지한다.
- 최종 노출 구조는 디자이너 handoff 중심으로 재구성한다.
- 질문 개선은 그 다음 정밀화 단계로 본다.

즉 이번 재검토의 최종 결론은:

`전략 lane의 다음 핵심 작업은 clarification의 추가 확장이 아니라, clarification 결과를 디자이너가 바로 쓸 수 있는 문서 구조로 다시 번역하는 것이다.`

이 문서를 이후 구현의 기준선으로 사용한다.
