# Crawl4AI Setup Guide

This guide explains how to set up and configure the Crawl4AI backend for enhanced web scraping capabilities.

## Overview

Crawl4AI is an optional backend service that provides:
- **LLM-powered extraction**: Use AI to intelligently extract data from complex pages
- **Batch processing**: Efficiently scrape multiple URLs in parallel
- **Fit Markdown**: LLM-optimized markdown output (67% fewer tokens vs raw HTML)
- **Advanced extraction**: CSS, XPath, Regex, and LLM extraction strategies

## Quick Start

### 1. Start Crawl4AI Docker Service

```bash
# Pull and run Crawl4AI (default port: 11235)
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  unclecode/crawl4ai:latest

# Verify it's running
curl http://localhost:11235/health
```

### 2. Enable in Extension Settings

1. Open the Web Scraper extension
2. Go to **Settings** (gear icon)
3. Scroll to **Crawl4AI Backend** section
4. Toggle **Enable Crawl4AI** to ON
5. Verify connection shows "Connected"

## Docker Configuration

### Basic Setup

```bash
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  --restart unless-stopped \
  unclecode/crawl4ai:latest
```

### With Resource Limits

```bash
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  --memory=4g \
  --cpus=2 \
  --restart unless-stopped \
  unclecode/crawl4ai:latest
```

### With Custom Port

```bash
docker run -d \
  --name crawl4ai \
  -p 8080:11235 \
  unclecode/crawl4ai:latest
```

Then update the Service URL in settings to `http://localhost:8080`.

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  crawl4ai:
    image: unclecode/crawl4ai:latest
    container_name: crawl4ai
    ports:
      - "11235:11235"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

Run with:
```bash
docker-compose up -d
```

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable Crawl4AI** | OFF | Master toggle for Crawl4AI integration |
| **Service URL** | `http://localhost:11235` | Crawl4AI Docker service endpoint |
| **Extraction Strategy** | Auto | How to choose extraction backend |
| **Fallback to Local** | ON | Use local extraction if Crawl4AI unavailable |
| **Enable LLM Extraction** | OFF | Enable AI-powered extraction (requires API key) |

### Extraction Strategy Options

- **Auto (Recommended)**: Automatically chooses local or Crawl4AI based on task complexity
- **Local Only**: Always use browser-based extraction (fastest, works offline)
- **Always Crawl4AI**: Route all extraction through Crawl4AI (best for complex pages)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌─────────────┐     ┌─────────────────────────────────┐    │
│  │ Content     │────▶│ Service Worker                   │    │
│  │ Script      │     │  ├─ Extraction Service           │    │
│  │ (DOM access)│     │  └─ Crawl4AI Client              │    │
│  └─────────────┘     └───────────────┬─────────────────┘    │
└──────────────────────────────────────┼──────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │   Crawl4AI Docker        │
                        │   (localhost:11235)      │
                        │   ├─ CSS Extraction      │
                        │   ├─ XPath Extraction    │
                        │   ├─ LLM Extraction      │
                        │   └─ Fit Markdown        │
                        └──────────────────────────┘
```

## When to Use Crawl4AI

### Use Local Extraction When:
- Simple, well-structured pages
- Speed is critical
- Working offline
- Low complexity selectors

### Use Crawl4AI When:
- Complex dynamic pages
- Need LLM-powered extraction
- Batch processing multiple URLs
- Want LLM-optimized markdown output
- Complex CSS selectors (`:nth-child`, `:has`, etc.)

## Troubleshooting

### Connection Failed

1. Check Docker is running: `docker ps`
2. Verify Crawl4AI container: `docker logs crawl4ai`
3. Test endpoint: `curl http://localhost:11235/health`
4. Check firewall allows port 11235

### Service Unavailable

The extension automatically falls back to local extraction when Crawl4AI is unavailable (if "Fallback to Local" is enabled).

### Slow Extraction

- Increase Docker memory limit
- Check network latency to Docker host
- Consider using "Auto" strategy to use local for simple tasks

### LLM Extraction Not Working

1. Ensure "Enable LLM Extraction" is ON
2. Verify LLM API key is configured in main LLM settings
3. Check Crawl4AI logs for API errors

## API Reference

The extension uses these Crawl4AI endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and version info |
| `/crawl` | POST | Single URL extraction |
| `/crawl-many` | POST | Batch URL extraction |

## Resources

- [Crawl4AI GitHub](https://github.com/unclecode/crawl4ai)
- [Crawl4AI Documentation](https://crawl4ai.com)
- [Docker Hub](https://hub.docker.com/r/unclecode/crawl4ai)
