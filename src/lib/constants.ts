// 질문 엔진 설정
export const MAX_QUESTIONS = 5;              // 최대 질문 수
export const CONVERGENCE_THRESHOLD = 2;      // 남은 후보가 이 이하면 수렴
export const NEITHER_TO_IMAGE_AB = 2;        // 연속 "둘 다 아닌데요" → 이미지 A/B 전환
export const NEITHER_TO_FREE_TEXT = 3;        // 연속 "둘 다 아닌데요" → 자유 텍스트

// 맥락 변수 가중치
export const BOOST_WEIGHT = 2;               // boost 분기 가산 점수
export const SUPPRESS_WEIGHT = -1;           // suppress 분기 감산 점수

// UI 관련
export const FREQUENT_TRIGGERS_COUNT = 8;    // 진입 화면에 표시할 빈출 트리거 수
export const PROGRESS_LABEL_FORMAT = '{current}/{total}'; // 진행률 표시 형식
