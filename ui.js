import { RANK_THRESHOLDS, GRADE_COLORS, METRIC_COLORS } from './calculate.js';

// SVG 원형 게이지 상수
const GAUGE_RADIUS = 80;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

// 결과 영역 DOM 참조
const resultsSection = document.getElementById('results');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const copyBtn = document.getElementById('copyMarkdownBtn');

// 로딩 스피너 표시
export function showLoading() {
  resultsSection.classList.add('hidden');
  errorEl.classList.add('hidden');
  copyBtn.classList.add('hidden');
  loadingEl.classList.remove('hidden');
}

// 로딩 스피너 숨기기
export function hideLoading() {
  loadingEl.classList.add('hidden');
}

// 에러 메시지 표시
export function showError(message) {
  hideLoading();
  resultsSection.classList.add('hidden');
  copyBtn.classList.add('hidden');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

// 결과 초기화
export function clearResults() {
  resultsSection.classList.add('hidden');
  resultsSection.innerHTML = '';
  errorEl.classList.add('hidden');
  copyBtn.classList.add('hidden');
}

// 원형 게이지 SVG 렌더링
function renderGauge(result) {
  const color = GRADE_COLORS[result.grade];
  const targetOffset = GAUGE_CIRCUMFERENCE * (1 - result.score);

  return `
    <div class="rank-card">
      <h3>Your Rank</h3>
      <div class="gauge-container">
        <svg viewBox="0 0 200 200" class="gauge-svg">
          <circle cx="100" cy="100" r="${GAUGE_RADIUS}" fill="none"
            stroke="var(--border-color)" stroke-width="8" />
          <circle cx="100" cy="100" r="${GAUGE_RADIUS}" fill="none"
            stroke="${color}" stroke-width="8"
            class="gauge-progress"
            stroke-dasharray="${GAUGE_CIRCUMFERENCE}"
            stroke-dashoffset="${GAUGE_CIRCUMFERENCE}"
            data-target="${targetOffset}"
            transform="rotate(-90 100 100)"
            stroke-linecap="round" />
          <text x="100" y="88" text-anchor="middle"
            class="gauge-grade" fill="${color}">${result.grade}</text>
          <text x="100" y="118" text-anchor="middle"
            class="gauge-percentile">Top ${result.percentile.toFixed(1)}%</text>
        </svg>
      </div>
    </div>`;
}

// 지표별 기여도 바 차트 렌더링
function renderMetricsChart(metrics) {
  const rows = metrics.map(m => {
    const pct = (m.percentile * 100).toFixed(1);
    const color = METRIC_COLORS[m.key];

    return `
      <div class="metric-row">
        <span class="metric-label">${m.label}</span>
        <div class="metric-bar-track">
          <div class="metric-bar" data-width="${pct}"
            style="width:0%;background:${color}"></div>
        </div>
        <span class="metric-value">${m.value.toLocaleString()}</span>
        <span class="metric-pct">${pct}%</span>
      </div>`;
  }).join('');

  return `
    <div class="metrics-chart">
      <h3>Metric Contributions</h3>
      ${rows}
    </div>`;
}

// 다음 등급 달성 조건 렌더링
function renderNextRank(nextRank) {
  if (!nextRank) {
    return `<div class="next-rank congrats">
      <h3>You've reached the highest rank!</h3>
      <p>S rank means you're in the top 1% of GitHub users.</p>
    </div>`;
  }

  // 달성 가능한 지표만 필터링하여 표시
  const achievableRows = nextRank.requirements
    .filter(r => r.possible && r.increase > 0)
    .sort((a, b) => a.increase - b.increase)
    .map((r, idx) => `
      <tr class="${idx === 0 ? 'easiest' : ''}">
        <td>${r.label}</td>
        <td>${r.value.toLocaleString()}</td>
        <td>${r.neededValue.toLocaleString()}</td>
        <td class="increase-cell">+${r.increase.toLocaleString()}</td>
      </tr>`)
    .join('');

  // 단독 달성 불가능한 지표 표시
  const impossibleRows = nextRank.requirements
    .filter(r => !r.possible)
    .map(r => `
      <tr class="impossible">
        <td>${r.label}</td>
        <td>${r.value.toLocaleString()}</td>
        <td colspan="2" class="impossible-text">Cannot achieve alone</td>
      </tr>`)
    .join('');

  return `
    <div class="next-rank">
      <h3>Road to ${nextRank.nextGrade}</h3>
      <p class="next-rank-desc">Each row shows what a single metric needs to reach ${nextRank.nextGrade} (top ${nextRank.nextPercentile}%).</p>
      <table>
        <thead>
          <tr><th>Metric</th><th>Current</th><th>Needed</th><th>Increase</th></tr>
        </thead>
        <tbody>${achievableRows}${impossibleRows}</tbody>
      </table>
    </div>`;
}

// 등급 체계 스케일 렌더링
function renderGradeScale(currentGrade) {
  const badges = RANK_THRESHOLDS.map(t => {
    const isActive = t.grade === currentGrade;
    const color = GRADE_COLORS[t.grade];
    return `<div class="grade-item ${isActive ? 'active' : ''}">
      <span class="grade-badge" style="background:${color}">${t.grade}</span>
      <span class="grade-pct">${t.percentile}%</span>
    </div>`;
  }).join('');

  return `
    <div class="grade-scale-section">
      <h3>Grade Scale</h3>
      <div class="grade-scale">${badges}</div>
    </div>`;
}

// 게이지 채움 애니메이션 실행
function animateGauge() {
  const progressEl = document.querySelector('.gauge-progress');
  if (!progressEl) return;
  requestAnimationFrame(() => {
    progressEl.style.strokeDashoffset = progressEl.dataset.target;
  });
}

// 지표 바 순차 애니메이션 실행
function animateMetricBars() {
  const bars = document.querySelectorAll('.metric-bar');
  bars.forEach((bar, i) => {
    setTimeout(() => {
      bar.style.width = bar.dataset.width + '%';
    }, 150 + i * 100);
  });
}

// 전체 결과 렌더링
export function renderResults(result, nextRank) {
  hideLoading();
  errorEl.classList.add('hidden');

  // 결과 HTML 조합
  resultsSection.innerHTML = `
    <div class="results-grid">
      ${renderGauge(result)}
      ${renderMetricsChart(result.metrics)}
    </div>
    ${renderNextRank(nextRank)}
    ${renderGradeScale(result.grade)}`;

  resultsSection.classList.remove('hidden');
  copyBtn.classList.remove('hidden');

  // DOM 업데이트 후 애니메이션 시작
  requestAnimationFrame(() => {
    animateGauge();
    animateMetricBars();
  });
}

// 결과를 마크다운 텍스트로 변환
export function generateMarkdown(result) {
  const header = `## GitHub Stats Rank: ${result.grade} (Top ${result.percentile.toFixed(1)}%)`;
  const tableHeader = '| Metric | Value | Percentile |';
  const separator = '|--------|-------|------------|';
  const rows = result.metrics.map(m =>
    `| ${m.label} | ${m.value.toLocaleString()} | ${(m.percentile * 100).toFixed(1)}% |`
  ).join('\n');
  const footer = '> Calculated with [GitHub Rank Insight](https://pachir1su.github.io/github-rank-insight/)';

  return `${header}\n\n${tableHeader}\n${separator}\n${rows}\n\n${footer}`;
}
