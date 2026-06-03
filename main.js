import { calculateRank, calculateNextRankRequirements } from './calculate.js';
import { fetchUserStats } from './api.js';
import { renderResults, showLoading, hideLoading, showError, clearResults, generateMarkdown } from './ui.js';

// DOM 요소 참조
const tabButtons = document.querySelectorAll('.tab');
const autoPanel = document.getElementById('autoMode');
const manualPanel = document.getElementById('manualMode');
const usernameInput = document.getElementById('usernameInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const calculateBtn = document.getElementById('calculateBtn');
const allCommitsToggle = document.getElementById('allCommitsToggle');
const copyBtn = document.getElementById('copyMarkdownBtn');
const tokenToggle = document.getElementById('tokenToggle');
const tokenBody = document.getElementById('tokenBody');
const tokenInput = document.getElementById('tokenInput');
const saveTokenBtn = document.getElementById('saveTokenBtn');
const clearTokenBtn = document.getElementById('clearTokenBtn');
const howItWorksToggle = document.getElementById('howItWorksToggle');
const howItWorksBody = document.getElementById('howItWorksBody');

// Auto 모드 조회 결과 편집 영역
const fetchedValuesEl = document.getElementById('fetchedValues');
const fetchMethodEl = document.getElementById('fetchMethod');
const recalculateBtn = document.getElementById('recalculateBtn');
const autoStarsInput = document.getElementById('autoStars');
const autoPrsInput = document.getElementById('autoPrs');
const autoCommitsInput = document.getElementById('autoCommits');
const autoIssuesInput = document.getElementById('autoIssues');
const autoFollowersInput = document.getElementById('autoFollowers');

// 마지막 계산 결과 저장 (마크다운 복사용)
let lastResult = null;

// 모드 전환 처리
function switchMode(mode) {
  tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  autoPanel.classList.toggle('hidden', mode !== 'auto');
  manualPanel.classList.toggle('hidden', mode !== 'manual');
  clearResults();
  fetchedValuesEl.classList.add('hidden');
}

// Auto 모드 조회 결과를 편집 필드에 표시
function showFetchedValues(stats) {
  autoStarsInput.value = stats.stars;
  autoPrsInput.value = stats.prs;
  autoCommitsInput.value = stats.commits;
  autoIssuesInput.value = stats.issues;
  autoFollowersInput.value = stats.followers;

  // API 방식 표시
  if (stats.method === 'graphql') {
    fetchMethodEl.textContent = 'Fetched via GraphQL API (same as github-readme-stats)';
    fetchMethodEl.className = 'fetch-method graphql';
  } else {
    fetchMethodEl.textContent = 'Fetched via REST API — values may differ from github-readme-stats. Add a token for exact results.';
    fetchMethodEl.className = 'fetch-method rest';
  }

  fetchedValuesEl.classList.remove('hidden');
}

// 편집 필드에서 현재 값 읽기
function readAutoStats() {
  return {
    stars: parseInt(autoStarsInput.value, 10) || 0,
    prs: parseInt(autoPrsInput.value, 10) || 0,
    commits: parseInt(autoCommitsInput.value, 10) || 0,
    issues: parseInt(autoIssuesInput.value, 10) || 0,
    followers: parseInt(autoFollowersInput.value, 10) || 0
  };
}

// 통계로 등급 계산 후 렌더링
function calculateAndRender(stats) {
  const includeAllCommits = allCommitsToggle.checked;
  const result = calculateRank(stats, includeAllCommits);
  const nextRank = calculateNextRankRequirements(result, includeAllCommits);
  lastResult = result;
  renderResults(result, nextRank);
}

// 자동 모드: API 조회 후 등급 계산
async function handleAnalyze() {
  const username = usernameInput.value.trim();
  if (!username) {
    showError('Please enter a GitHub username.');
    return;
  }

  // 버튼 비활성화 및 로딩 표시
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  showLoading();
  fetchedValuesEl.classList.add('hidden');

  try {
    const token = localStorage.getItem('github_token') || null;
    const includeAllCommits = allCommitsToggle.checked;
    const stats = await fetchUserStats(username, token, includeAllCommits);

    // 조회된 값을 편집 필드에 표시
    showFetchedValues(stats);

    // 등급 계산 및 렌더링
    calculateAndRender(stats);
  } catch (error) {
    showError(error.message);
  } finally {
    // 버튼 상태 복원
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
  }
}

// Auto 모드 편집 필드에서 재계산
function handleRecalculate() {
  try {
    const stats = readAutoStats();
    calculateAndRender(stats);
  } catch (error) {
    showError(error.message);
  }
}

// 수동 모드: 입력값 기반 등급 계산
function handleCalculate() {
  try {
    const stats = {
      stars: parseInt(document.getElementById('starsInput').value, 10) || 0,
      prs: parseInt(document.getElementById('prsInput').value, 10) || 0,
      commits: parseInt(document.getElementById('commitsInput').value, 10) || 0,
      issues: parseInt(document.getElementById('issuesInput').value, 10) || 0,
      followers: parseInt(document.getElementById('followersInput').value, 10) || 0
    };

    calculateAndRender(stats);
  } catch (error) {
    showError(error.message);
  }
}

// 마크다운 텍스트 클립보드 복사
async function handleCopyMarkdown() {
  if (!lastResult) return;

  try {
    const markdown = generateMarkdown(lastResult);
    await navigator.clipboard.writeText(markdown);

    // 복사 완료 피드백
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (error) {
    showError('Failed to copy to clipboard.');
  }
}

// 아코디언 토글 처리
function toggleAccordion(toggleEl, bodyEl) {
  const isOpen = !bodyEl.classList.contains('hidden');
  bodyEl.classList.toggle('hidden');
  toggleEl.classList.toggle('open', !isOpen);
}

// GitHub 토큰 저장
function handleSaveToken() {
  const token = tokenInput.value.trim();
  if (!token) {
    tokenInput.focus();
    return;
  }
  localStorage.setItem('github_token', token);
  tokenInput.value = '';
  tokenInput.placeholder = 'Token saved';
  setTimeout(() => { tokenInput.placeholder = 'ghp_...'; }, 2000);
}

// GitHub 토큰 삭제
function handleClearToken() {
  localStorage.removeItem('github_token');
  tokenInput.value = '';
  tokenInput.placeholder = 'Token cleared';
  setTimeout(() => { tokenInput.placeholder = 'ghp_...'; }, 2000);
}

// 페이지 초기화: 저장된 토큰 표시
function initTokenStatus() {
  const savedToken = localStorage.getItem('github_token');
  if (savedToken) {
    tokenInput.placeholder = 'Token is saved (enter new to replace)';
  }
}

// 이벤트 리스너 등록
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

analyzeBtn.addEventListener('click', handleAnalyze);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAnalyze();
});

calculateBtn.addEventListener('click', handleCalculate);
recalculateBtn.addEventListener('click', handleRecalculate);
copyBtn.addEventListener('click', handleCopyMarkdown);

tokenToggle.addEventListener('click', () => toggleAccordion(tokenToggle, tokenBody));
saveTokenBtn.addEventListener('click', handleSaveToken);
clearTokenBtn.addEventListener('click', handleClearToken);

howItWorksToggle.addEventListener('click', () => toggleAccordion(howItWorksToggle, howItWorksBody));

// 수동 입력 필드에서 Enter 키로 계산 실행
document.querySelectorAll('.manual-input').forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCalculate();
  });
});

// Auto 모드 편집 필드에서 Enter 키로 재계산
document.querySelectorAll('.auto-stat-input').forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRecalculate();
  });
});

// 초기화
initTokenStatus();
usernameInput.focus();
