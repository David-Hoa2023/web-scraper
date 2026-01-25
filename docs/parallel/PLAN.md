# Parallel Execution Plan

**Run ID:** web-scraper-b1
**Source:** docs/backlog/backlog-1.yaml
**Created:** 2026-01-25
**Status:** ready

## Overview

Chrome Extension web scraper enhancement with improved pattern detection, auto-scrolling, data extraction, Shadow DOM support, and UX improvements.

## RLM Limits

<guideline>
- Max 3 routes per task context
- Max 40 grep hits, 12 snippets, 80 lines each
- Run log summary <= 30 lines
- Do not paste whole files
</guideline>

## Dependency Graph

```
Stage 0: [t01-project-setup]
              |
    +---------+---------+
    |         |         |
Stage 1: [t02-pattern]  |
    |         |         |
Stage 2: [t04-extract] [t03-scroller]
    |         |         |
Stage 3: [t05-shadow]   |
              |         |
Stage 4: [t06-overlay] [t07-popup]
              |         |
Stage 5:      [t08-integration]
```

## Execution Order

### Wave 1 (Foundation)
| Task ID | Title | Dependencies | Status |
|---------|-------|--------------|--------|
| ws-b1-t01-project-setup | Project Setup & TypeScript Configuration | - | pending |

### Wave 2 (Core Features - Parallel)
| Task ID | Title | Dependencies | Status |
|---------|-------|--------------|--------|
| ws-b1-t02-pattern-detector | Enhanced Pattern Detection | t01 | pending |
| ws-b1-t03-auto-scroller | Auto-Scroller with Throttling | t01 | pending |

### Wave 3 (Data Layer)
| Task ID | Title | Dependencies | Status |
|---------|-------|--------------|--------|
| ws-b1-t04-data-extractor | Flexible Data Extraction | t01, t02 | pending |

### Wave 4 (Advanced Features)
| Task ID | Title | Dependencies | Status |
|---------|-------|--------------|--------|
| ws-b1-t05-shadow-dom | Shadow DOM Support | t02, t04 | pending |

### Wave 5 (UI - Parallel)
| Task ID | Title | Dependencies | Status |
|---------|-------|--------------|--------|
| ws-b1-t06-ui-overlay | UI Overlay with Progress | t01, t03 | pending |
| ws-b1-t07-popup | Extension Popup UI | t01, t04 | pending |

### Wave 6 (Integration)
| Task ID | Title | Dependencies | Status |
|---------|-------|--------------|--------|
| ws-b1-t08-integration | Integration and E2E Testing | t02-t07 | pending |

## Task Summary

| # | Task ID | Stage | Priority | Est. |
|---|---------|-------|----------|------|
| 1 | ws-b1-t01-project-setup | 0 | 1 | 30min |
| 2 | ws-b1-t02-pattern-detector | 1 | 2 | 45min |
| 3 | ws-b1-t03-auto-scroller | 2 | 3 | 45min |
| 4 | ws-b1-t04-data-extractor | 2 | 4 | 40min |
| 5 | ws-b1-t05-shadow-dom | 3 | 5 | 35min |
| 6 | ws-b1-t06-ui-overlay | 4 | 6 | 50min |
| 7 | ws-b1-t07-popup | 4 | 7 | 45min |
| 8 | ws-b1-t08-integration | 5 | 8 | 60min |

**Total Tasks:** 8

## Worker Instructions

1. Check out branch: `git checkout -b task/<taskId>`
2. Read TaskCard: `docs/parallel/tasks/<taskId>.yaml`
3. Load context (RLM-limited)
4. Implement within `files.allow` only
5. Run verify commands from TaskCard
6. Update run log: `docs/parallel/runs/<taskId>.md`
7. Commit with message: `feat(ws-b1): <task title>`

## Reducer Instructions

1. Merge in dependency order (Stage 0 first)
2. Run quick verify after each merge
3. Run `/deep-verify --full` at end
4. Update CODEMEM if interfaces changed
5. Final commit: `ship(web-scraper-b1): Chrome Extension MVP`

## Reducer Helper (Windows)

Open PLAN.md + list TaskCards + list run logs for this run:
```powershell
pwsh scripts/parallel/openRunDir.ps1 -RunId web-scraper-b1 -Explorer
```
