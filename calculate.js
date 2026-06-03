// 등급 기준 퍼센타일 상수
export const RANK_THRESHOLDS = [
  { grade: 'S', percentile: 1 },
  { grade: 'A+', percentile: 12.5 },
  { grade: 'A', percentile: 25 },
  { grade: 'A-', percentile: 37.5 },
  { grade: 'B+', percentile: 50 },
  { grade: 'B', percentile: 62.5 },
  { grade: 'B-', percentile: 75 },
  { grade: 'C+', percentile: 87.5 },
  { grade: 'C', percentile: 100 }
];

// 지표 정의 (가중치, 중앙값, 분포 타입)
export const METRICS = [
  { key: 'stars', label: 'Stars', weight: 4, median: 50, allCommitsMedian: 50, distribution: 'log-normal' },
  { key: 'prs', label: 'Pull Requests', weight: 3, median: 50, allCommitsMedian: 50, distribution: 'exponential' },
  { key: 'commits', label: 'Commits', weight: 2, median: 250, allCommitsMedian: 1000, distribution: 'exponential' },
  { key: 'issues', label: 'Issues', weight: 1, median: 25, allCommitsMedian: 25, distribution: 'exponential' },
  { key: 'followers', label: 'Followers', weight: 1, median: 10, allCommitsMedian: 10, distribution: 'log-normal' }
];

// 등급별 테마 색상
export const GRADE_COLORS = {
  'S': '#ffd700',
  'A+': '#b388ff',
  'A': '#448aff',
  'A-': '#40c4ff',
  'B+': '#69f0ae',
  'B': '#b2ff59',
  'B-': '#eeff41',
  'C+': '#ffd740',
  'C': '#8b949e'
};

// 지표별 차트 색상
export const METRIC_COLORS = {
  stars: '#e3b341',
  prs: '#3fb950',
  commits: '#58a6ff',
  issues: '#d29922',
  followers: '#bc8cff'
};

// Exponential CDF: 1 - 2^(-x)
function exponentialCdf(x) {
  return 1 - Math.pow(2, -x);
}

// Log-normal CDF: x / (1 + x)
function logNormalCdf(x) {
  return x / (1 + x);
}

// Exponential CDF 역함수: -log2(1 - y)
function inverseExponentialCdf(y) {
  if (y >= 1) return Infinity;
  if (y <= 0) return 0;
  return -Math.log2(1 - y);
}

// Log-normal CDF 역함수: y / (1 - y)
function inverseLogNormalCdf(y) {
  if (y >= 1) return Infinity;
  if (y <= 0) return 0;
  return y / (1 - y);
}

// 분포 타입에 따른 CDF 선택 적용
function applyCdf(value, median, distribution) {
  try {
    const normalized = value / median;
    return distribution === 'exponential'
      ? exponentialCdf(normalized)
      : logNormalCdf(normalized);
  } catch (error) {
    throw new Error(`CDF calculation failed for value=${value}, median=${median}: ${error.message}`);
  }
}

// 종합 등급 계산
export function calculateRank(stats, includeAllCommits = false) {
  try {
    const totalWeight = METRICS.reduce((sum, m) => sum + m.weight, 0);

    // 각 지표의 퍼센타일 및 가중 기여도 계산
    const metrics = METRICS.map(metric => {
      const median = (metric.key === 'commits' && includeAllCommits)
        ? metric.allCommitsMedian
        : metric.median;
      const value = Math.max(0, stats[metric.key] || 0);
      const percentile = applyCdf(value, median, metric.distribution);

      return {
        key: metric.key,
        label: metric.label,
        weight: metric.weight,
        value,
        median,
        distribution: metric.distribution,
        percentile,
        contribution: percentile * metric.weight
      };
    });

    // 종합 점수 산출 (0~1, 높을수록 좋음)
    const score = metrics.reduce((sum, m) => sum + m.contribution, 0) / totalWeight;
    const percentile = (1 - score) * 100;

    // 퍼센타일 기준 등급 판정
    let grade = 'C';
    for (const threshold of RANK_THRESHOLDS) {
      if (percentile <= threshold.percentile) {
        grade = threshold.grade;
        break;
      }
    }

    return { grade, score, percentile, metrics };
  } catch (error) {
    throw new Error(`Rank calculation failed: ${error.message}`);
  }
}

// 다음 등급 달성에 필요한 지표별 조건 계산
export function calculateNextRankRequirements(result, includeAllCommits = false) {
  try {
    // S등급은 최고 등급이므로 null 반환
    if (result.grade === 'S') return null;

    const currentIndex = RANK_THRESHOLDS.findIndex(t => t.grade === result.grade);
    if (currentIndex <= 0) return null;

    const nextThreshold = RANK_THRESHOLDS[currentIndex - 1];
    const targetScore = 1 - nextThreshold.percentile / 100;
    const totalWeight = METRICS.reduce((sum, m) => sum + m.weight, 0);

    // 각 지표를 단독으로 개선할 때 필요한 수치 계산
    const requirements = result.metrics.map(metric => {
      const otherContributions = result.metrics
        .filter(m => m.key !== metric.key)
        .reduce((sum, m) => sum + m.contribution, 0);

      const neededContribution = targetScore * totalWeight - otherContributions;
      const neededPercentile = neededContribution / metric.weight;

      // 이미 충분한 경우
      if (neededPercentile <= metric.percentile) {
        return { key: metric.key, label: metric.label, value: metric.value, neededValue: metric.value, increase: 0, possible: true };
      }

      // 단독 개선으로는 불가능한 경우
      if (neededPercentile >= 1) {
        return { key: metric.key, label: metric.label, value: metric.value, neededValue: Infinity, increase: Infinity, possible: false };
      }

      // 역 CDF로 필요한 실제 수치 산출
      const inverseFn = metric.distribution === 'exponential' ? inverseExponentialCdf : inverseLogNormalCdf;
      const neededNormalized = inverseFn(neededPercentile);
      const neededValue = Math.ceil(neededNormalized * metric.median);
      const increase = Math.max(0, neededValue - metric.value);

      return { key: metric.key, label: metric.label, value: metric.value, neededValue, increase, possible: true };
    });

    return { nextGrade: nextThreshold.grade, nextPercentile: nextThreshold.percentile, requirements };
  } catch (error) {
    throw new Error(`Next rank calculation failed: ${error.message}`);
  }
}
