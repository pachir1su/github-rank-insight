# GitHub Rank Insight

> Analyze your GitHub Stats rank, visualize metric contributions, and discover what it takes to level up.

**[Live Demo](https://pachir1su.github.io/github-rank-insight/)**

---

## Features

- **Auto Mode** - Enter a GitHub username and get instant rank analysis via the GitHub REST API
- **Manual Mode** - Input your own numbers to simulate different scenarios
- **Rank Gauge** - Circular SVG gauge showing your grade (S ~ C) and top percentile
- **Metric Breakdown** - Bar chart of each metric's CDF percentile and weighted contribution
- **Next Rank Roadmap** - See exactly what each metric needs to reach the next grade
- **Copy Markdown** - One-click copy of results for your README
- **GitHub Token Support** - Optional token input to increase API rate limits (stored in localStorage only)

## How it Works

This tool implements the same ranking algorithm as [github-readme-stats](https://github.com/anuraghazra/github-readme-stats).

### CDF Functions

```
exponential_cdf(x) = 1 - 2^(-x)
log_normal_cdf(x)  = x / (1 + x)
```

### Metrics & Weights

| Metric | Weight | Median | Distribution |
|--------|--------|--------|-------------|
| Stars | 4 | 50 | log-normal |
| Pull Requests | 3 | 50 | exponential |
| Commits | 2 | 250 (all: 1000) | exponential |
| Issues | 1 | 25 | exponential |
| Followers | 1 | 10 | log-normal |

### Score & Grade

```
score = (stars×4 + prs×3 + commits×2 + issues×1 + followers×1) / 11
percentile = (1 - score) × 100
```

| Grade | Top Percentile |
|-------|---------------|
| S | 1% |
| A+ | 12.5% |
| A | 25% |
| A- | 37.5% |
| B+ | 50% |
| B | 62.5% |
| B- | 75% |
| C+ | 87.5% |
| C | rest |

## Tech Stack

| Item | Choice |
|------|--------|
| Language | HTML / CSS / Vanilla JS (ES Modules) |
| API | GitHub REST API v3 |
| Style | CSS Variables + Grid/Flexbox |
| Deploy | GitHub Pages (static, serverless) |

## Project Structure

```
github-rank-insight/
├── index.html        # Main page
├── style.css         # Styles (GitHub Dark theme)
├── main.js           # Entry point & event handling
├── calculate.js      # Rank calculation logic
├── api.js            # GitHub API calls
├── ui.js             # DOM rendering & animations
└── assets/
```

## Getting Started

1. Clone the repo
2. Open `index.html` in a browser (or serve via any static server)
3. Enter a GitHub username and click **Analyze**

> **Note:** The app uses ES Modules, so it must be served over HTTP(S). Opening `index.html` directly via `file://` may not work in some browsers.

## License

MIT
