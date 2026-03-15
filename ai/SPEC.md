# Current Implementation Notes

## Session Flow

- Steps remain `entry -> context -> questions -> confirm -> brief`.
- `confirm` 단계에서 사용자가 재질문을 선택하면 `/api/session/[id]/refine`를 통해 추가 질문을 생성한 뒤 `questions` 단계로 복귀한다.
- 질문 흐름 상태는 `src/store/sessionStore.ts`에서 오케스트레이션하고, 질문 생성 규칙은 `src/lib/questionEngine.ts`에 유지한다.

## Brief Persistence

- 브리프는 `src/lib/briefStore.ts`에서 `.runtime/briefs/{sessionId}.json` 파일로 저장한다.
- permalink 조회는 `GET /api/brief/[id]`, 생성은 `POST /api/brief/[id]/generate`가 담당한다.

## Brief Export

- 브리프 화면과 permalink 화면 모두 `src/lib/briefExport.ts`를 통해 `html2pdf.js` 기반 PDF 다운로드를 제공한다.
- 브리프 화면에는 permalink 복사 UI를 함께 제공한다.

## Build Stability

- 루트 레이아웃은 외부 Google Fonts를 사용하지 않는다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 기준으로 현재 빌드 가능 상태를 유지한다.
