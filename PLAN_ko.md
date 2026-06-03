# github-rank-insight 기획서
 
> GitHub Stats 등급을 자동 또는 수동으로 계산하고, 지표별 기여도와 등급 달성 조건을 시각화하는 웹 도구
 
---
 
## 1. 프로젝트 개요
 
| 항목 | 내용 |
|------|------|
| 리포지토리명 | `github-rank-insight` |
| 배포 방식 | GitHub Pages (순수 HTML/CSS/JS, 서버리스) |
| 타겟 사용자 | GitHub Stats 카드를 사용하는 모든 개발자 |
| 핵심 가치 | username 하나만 입력하면 즉시 등급 분석 결과 제공 |
 
---
 
## 2. 핵심 기능
 
### 2-1. 자동 모드 (기본)
 
- GitHub username 입력 → GitHub REST API 자동 호출
- Stars, Commits, PRs, Issues, Followers 자동 조회
- 인증 없이 동작 (비인증 API: 60회/시간 제한)
### 2-2. 수동 모드
 
- Stars, Commits, PRs, Issues, Followers 수치 직접 입력
- API 제한에 관계없이 동작
- "내 미래 수치를 넣어보면 어떤 등급이 될까" 시뮬레이션 용도로 활용 가능
### 2-3. GitHub Token 입력 (옵션 B)
 
- 사용자가 직접 Personal Access Token 입력 시 API 제한 해제 (5000회/시간)
- 토큰은 브라우저 `localStorage`에만 저장, 서버로 전송되지 않음
- 토큰 입력 UI는 설정 영역에 별도 배치, 기본적으로는 숨김 처리
---
 
## 3. 계산 알고리즘
 
`anuraghazra/github-readme-stats`의 `calculateRank.js` 공식을 그대로 구현
 
### CDF 함수
 
```
exponential_cdf(x) = 1 - 2^(-x)
log_normal_cdf(x)  = x / (1 + x)
```
 
### 지표별 가중치 및 중앙값
 
| 지표 | 가중치 | 중앙값 | 분포 |
|------|--------|--------|------|
| Stars | 4 | 50 | log-normal |
| Pull Requests | 3 | 50 | exponential |
| Commits | 2 | 250 (전체: 1000) | exponential |
| Issues | 1 | 25 | exponential |
| Followers | 1 | 10 | log-normal |
 
### 점수 계산
 
```
score = (stars_p×4 + prs_p×3 + commits_p×2 + issues_p×1 + followers_p×1) / 11
percentile = (1 - score) × 100
```
 
### 등급 기준
 
| 등급 | 상위 퍼센타일 |
|------|--------------|
| S | 1% |
| A+ | 12.5% |
| A | 25% |
| A- | 37.5% |
| B+ | 50% |
| B | 62.5% |
| B- | 75% |
| C+ | 87.5% |
| C | 나머지 전체 |
 
---
 
## 4. 화면 구성
 
### 4-1. 상단 — 입력 영역
 
```
[ GitHub username 입력 ]  [조회]   /   [수동 입력으로 전환]
```
 
- 자동/수동 탭 전환
- 수동 모드 시 Stars / PRs / Commits / Issues / Followers 입력 필드 노출
- `include_all_commits` 토글 (Commits 중앙값 250 vs 1000 전환)
### 4-2. 결과 영역
 
1. **등급 카드** — 원형 게이지 + 등급 문자 + percentile 수치
2. **지표별 기여도 바 차트** — 각 지표의 CDF 퍼센타일과 가중 기여량 시각화
3. **다음 등급 달성 조건** — 현재 등급에서 한 단계 위로 가기 위해 부족한 지표 안내
4. **등급 체계 표** — S ~ C 전체 등급 기준 상시 표시
### 4-3. 하단 — 부가 기능
 
- `Copy Markdown` 버튼 — 결과를 README에 붙여넣기 가능한 텍스트로 복사
- GitHub Token 입력 토글 (접어두기 기본, 펼치면 입력 필드 노출)
- 계산 방식 설명 아코디언 (공식 출처 링크 포함)
---
 
## 5. 기술 스택
 
| 항목 | 선택 | 이유 |
|------|------|------|
| 언어 | HTML / CSS / Vanilla JS | 서버 불필요, GitHub Pages 바로 배포 |
| API | GitHub REST API v3 | 인증 없이 공개 데이터 조회 가능 |
| 스타일 | CSS Variables + Flexbox/Grid | 외부 프레임워크 의존성 제거 |
| 배포 | GitHub Pages (`main` 브랜치 `/` 루트) | 무료, 별도 설정 최소화 |
 
---
 
## 6. 파일 구조 (예정)
 
```
github-rank-insight/
├── index.html
├── style.css
├── main.js
│   ├── api.js          # GitHub API 호출
│   ├── calculate.js    # 등급 계산 로직 (calculateRank 구현)
│   └── ui.js           # DOM 조작 및 렌더링
├── assets/
│   └── preview.png     # README 미리보기 이미지
└── README.md
```
 
---
 
## 7. README 구성 (Star 유도 전략)
 
- 상단에 라이브 데모 링크 (`GitHub Pages URL`) 배치
- 결과 화면 스크린샷 GIF 삽입
- "How it works" 섹션에 알고리즘 설명
- `anuraghazra/github-readme-stats` 이슈/토론에 본 프로젝트 링크 코멘트 등록 고려
---
 
## 8. 개발 순서
 
1. `calculate.js` — 계산 로직 구현 및 테스트
2. `index.html` + `style.css` — 기본 레이아웃
3. 수동 모드 UI 및 계산 연동
4. `api.js` — GitHub API 자동 조회 연동
5. Token 입력 기능 추가
6. 다음 등급 달성 조건 계산 로직
7. Copy Markdown 기능
8. README 작성 및 GitHub Pages 배포
---


README는 기본 영어로. 한국어 버전은 따로 만들기
