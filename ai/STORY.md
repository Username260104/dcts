# 2026-03-15

- 확인 단계에서 결과가 맞지 않을 때 `entry`로 초기화되던 흐름을 `questions` 단계로 재진입하는 refinement 흐름으로 수정했다.
- `src/app/api/session/[id]/refine/route.ts`를 추가해 추가 질문 생성을 API 경계에서 처리하도록 분리했다.
- 브리프 저장소를 in-memory `Map`에서 파일 기반 저장으로 변경해 permalink가 서버 재시작 이후에도 유지되게 했다.
- 브리프 화면과 permalink 화면에 공유 링크 복사 및 PDF 다운로드 기능을 추가했다.
- `next/font/google` 의존성을 제거해 네트워크 차단 환경에서도 빌드가 가능하도록 조정했다.
