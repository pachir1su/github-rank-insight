// GitHub API 기본 URL
const API_BASE = 'https://api.github.com';

// API 응답 검증 및 에러 처리
async function handleResponse(response) {
  if (response.status === 404) {
    throw new Error('User not found. Please check the username.');
  }
  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimitRemaining === '0') {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const resetDate = new Date(resetTime * 1000);
      throw new Error(`API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}. Try adding a GitHub token.`);
    }
    throw new Error('API access forbidden. Try adding a GitHub token.');
  }
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// 인증 헤더 생성
function buildHeaders(token) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  return headers;
}

// 유저의 전체 리포지토리에서 스타 수 합산 (포크 제외, 페이지네이션)
async function fetchTotalStars(username, headers) {
  let totalStars = 0;
  let page = 1;

  try {
    while (page <= 50) {
      const response = await fetch(
        `${API_BASE}/users/${username}/repos?per_page=100&page=${page}&type=owner`,
        { headers }
      );
      const repos = await handleResponse(response);
      if (repos.length === 0) break;

      // 포크가 아닌 리포지토리의 스타만 합산
      totalStars += repos.reduce((sum, repo) => {
        return sum + (repo.fork ? 0 : repo.stargazers_count);
      }, 0);

      if (repos.length < 100) break;
      page++;
    }
  } catch (error) {
    throw new Error(`Failed to fetch stars: ${error.message}`);
  }

  return totalStars;
}

// 검색 API로 PR 수 조회
async function fetchPullRequestCount(username, headers) {
  try {
    const response = await fetch(
      `${API_BASE}/search/issues?q=author:${encodeURIComponent(username)}+type:pr`,
      { headers }
    );
    const data = await handleResponse(response);
    return data.total_count;
  } catch (error) {
    throw new Error(`Failed to fetch PRs: ${error.message}`);
  }
}

// 검색 API로 이슈 수 조회
async function fetchIssueCount(username, headers) {
  try {
    const response = await fetch(
      `${API_BASE}/search/issues?q=author:${encodeURIComponent(username)}+type:issue`,
      { headers }
    );
    const data = await handleResponse(response);
    return data.total_count;
  } catch (error) {
    throw new Error(`Failed to fetch issues: ${error.message}`);
  }
}

// 검색 API로 커밋 수 조회
async function fetchCommitCount(username, headers) {
  try {
    const commitHeaders = { ...headers, 'Accept': 'application/vnd.github.cloak-preview+json' };
    const response = await fetch(
      `${API_BASE}/search/commits?q=author:${encodeURIComponent(username)}`,
      { headers: commitHeaders }
    );
    const data = await handleResponse(response);
    return data.total_count;
  } catch (error) {
    throw new Error(`Failed to fetch commits: ${error.message}`);
  }
}

// 유저 프로필에서 팔로워 수 조회
async function fetchFollowerCount(username, headers) {
  try {
    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, { headers });
    const data = await handleResponse(response);
    return data.followers;
  } catch (error) {
    throw new Error(`Failed to fetch followers: ${error.message}`);
  }
}

// 모든 지표를 병렬로 조회하여 반환
export async function fetchUserStats(username, token = null) {
  if (!username || !username.trim()) {
    throw new Error('Username is required.');
  }

  const headers = buildHeaders(token);
  const trimmedUsername = username.trim();

  try {
    // 5개 API를 동시 호출하여 성능 최적화
    const [stars, prs, commits, issues, followers] = await Promise.all([
      fetchTotalStars(trimmedUsername, headers),
      fetchPullRequestCount(trimmedUsername, headers),
      fetchCommitCount(trimmedUsername, headers),
      fetchIssueCount(trimmedUsername, headers),
      fetchFollowerCount(trimmedUsername, headers)
    ]);

    return { stars, prs, commits, issues, followers };
  } catch (error) {
    throw new Error(`Failed to fetch stats for "${trimmedUsername}": ${error.message}`);
  }
}
