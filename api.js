// GitHub API 기본 URL
const API_BASE = 'https://api.github.com';
const GRAPHQL_URL = 'https://api.github.com/graphql';

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

// ─── GraphQL API (github-readme-stats 동일 방식, 토큰 필수) ───

// 유저 기본 정보 + 올해 커밋 + PR/이슈/팔로워 + 스타(1페이지)
const USER_STATS_QUERY = `
query userInfo($login: String!) {
  user(login: $login) {
    createdAt
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
    }
    pullRequests(first: 1) {
      totalCount
    }
    openIssues: issues(states: OPEN) {
      totalCount
    }
    closedIssues: issues(states: CLOSED) {
      totalCount
    }
    followers {
      totalCount
    }
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}) {
      nodes {
        stargazers {
          totalCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

// 추가 레포 페이지 조회 (스타 합산용)
const REPOS_PAGE_QUERY = `
query userRepos($login: String!, $after: String!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
      nodes {
        stargazers {
          totalCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

// 연도별 커밋 조회 (includeAllCommits용)
const YEARLY_COMMITS_QUERY = `
query yearlyContributions($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      restrictedContributionsCount
    }
  }
}`;

// GraphQL 요청 실행
async function graphqlRequest(token, query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json();

  if (data.errors) {
    const msg = data.errors[0]?.message || 'GraphQL request failed';
    if (msg.includes('Could not resolve to a User')) {
      throw new Error('User not found. Please check the username.');
    }
    throw new Error(msg);
  }

  return data.data;
}

// GraphQL 커서 페이지네이션으로 전체 스타 합산
async function fetchStarsGraphQL(token, username, initialRepos) {
  let totalStars = initialRepos.nodes.reduce(
    (sum, repo) => sum + repo.stargazers.totalCount, 0
  );

  let { hasNextPage, endCursor } = initialRepos.pageInfo;

  while (hasNextPage) {
    const data = await graphqlRequest(token, REPOS_PAGE_QUERY, {
      login: username, after: endCursor
    });
    const repos = data.user.repositories;
    totalStars += repos.nodes.reduce(
      (sum, repo) => sum + repo.stargazers.totalCount, 0
    );
    // 남은 레포가 전부 스타 0이면 조기 종료
    if (repos.nodes.every(r => r.stargazers.totalCount === 0)) break;
    hasNextPage = repos.pageInfo.hasNextPage;
    endCursor = repos.pageInfo.endCursor;
  }

  return totalStars;
}

// 전체 연도 커밋 합산 (병렬 요청)
async function fetchAllYearsCommitsGraphQL(token, username, createdAt) {
  const createdYear = new Date(createdAt).getFullYear();
  const currentYear = new Date().getFullYear();

  const promises = [];
  for (let year = createdYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    promises.push(
      graphqlRequest(token, YEARLY_COMMITS_QUERY, { login: username, from, to })
    );
  }

  const results = await Promise.all(promises);
  return results.reduce((total, data) => {
    const cc = data.user.contributionsCollection;
    return total + cc.totalCommitContributions + cc.restrictedContributionsCount;
  }, 0);
}

// GraphQL API 통합 조회
async function fetchUserStatsGraphQL(username, token, includeAllCommits) {
  try {
    const data = await graphqlRequest(token, USER_STATS_QUERY, { login: username });
    const user = data.user;

    const stars = await fetchStarsGraphQL(token, username, user.repositories);
    const prs = user.pullRequests.totalCount;
    const issues = user.openIssues.totalCount + user.closedIssues.totalCount;
    const followers = user.followers.totalCount;

    let commits;
    if (includeAllCommits) {
      commits = await fetchAllYearsCommitsGraphQL(token, username, user.createdAt);
    } else {
      const cc = user.contributionsCollection;
      commits = cc.totalCommitContributions + cc.restrictedContributionsCount;
    }

    return { stars, prs, commits, issues, followers };
  } catch (error) {
    throw new Error(`GraphQL fetch failed: ${error.message}`);
  }
}

// ─── REST API (토큰 불필요, 정확도 낮음) ───

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

// 검색 API로 커밋 수 조회 (올해만 또는 전체)
async function fetchCommitCount(username, headers, includeAllCommits) {
  try {
    const commitHeaders = { ...headers, 'Accept': 'application/vnd.github.cloak-preview+json' };
    let query = `author:${encodeURIComponent(username)}`;
    // 기본값: 올해 커밋만 (github-readme-stats 기본 동작과 일치)
    if (!includeAllCommits) {
      const year = new Date().getFullYear();
      query += `+author-date:>=${year}-01-01`;
    }
    const response = await fetch(
      `${API_BASE}/search/commits?q=${query}`,
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

// REST API 통합 조회
async function fetchUserStatsRest(username, headers, includeAllCommits) {
  const [stars, prs, commits, issues, followers] = await Promise.all([
    fetchTotalStars(username, headers),
    fetchPullRequestCount(username, headers),
    fetchCommitCount(username, headers, includeAllCommits),
    fetchIssueCount(username, headers),
    fetchFollowerCount(username, headers)
  ]);
  return { stars, prs, commits, issues, followers };
}

// ─── 통합 조회 함수 ───

export async function fetchUserStats(username, token = null, includeAllCommits = false) {
  if (!username || !username.trim()) {
    throw new Error('Username is required.');
  }

  const trimmedUsername = username.trim();

  // 토큰이 있으면 GraphQL 우선 사용 (github-readme-stats 동일 방식)
  if (token) {
    try {
      const stats = await fetchUserStatsGraphQL(trimmedUsername, token, includeAllCommits);
      return { ...stats, method: 'graphql' };
    } catch (error) {
      // GraphQL 실패 시 REST API 폴백
      console.warn('GraphQL failed, falling back to REST:', error.message);
    }
  }

  // REST API 폴백 (토큰 없거나 GraphQL 실패 시)
  try {
    const headers = buildHeaders(token);
    const stats = await fetchUserStatsRest(trimmedUsername, headers, includeAllCommits);
    return { ...stats, method: 'rest' };
  } catch (error) {
    throw new Error(`Failed to fetch stats for "${trimmedUsername}": ${error.message}`);
  }
}
