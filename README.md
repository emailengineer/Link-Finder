# Link Finder

A powerful web crawler that finds all links on a website with depth-2 crawling. It uses a headless browser to render modern websites (including SPAs) and extracts links from robots.txt and sitemaps.

## Features

- **Depth-2 Crawling**: Crawls the homepage and all links found on it
- **Same-Domain Only**: Only keeps links from the same domain
- **Modern Website Support**: Uses Puppeteer to render JavaScript-heavy websites
- **Multi-Source Discovery**: 
  - Extracts links from rendered pages
  - Parses robots.txt for sitemap URLs
  - Extracts links from sitemap files
- **URL Validation**: Ensures all returned links are valid URLs
- **REST API**: Simple API endpoint to trigger crawls

## Prerequisites

- Node.js 18+
- Docker (optional)

## Installation

### One-Line Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/emailengineer/Link-Finder/main/install.sh | bash
```

Or download and run:

```bash
chmod +x install.sh
./install.sh
```

### Local Development

```bash
npm install
```

### Docker

```bash
docker build -t link-finder .
docker run -p 3000:3000 link-finder
```

## Usage

### Start the Server

```bash
npm start
# or for development
npm run dev
```

### API Endpoint

**POST** `/api/crawl`

Request body:
```json
{
  "url": "https://example.com"
}
```

Response:
```json
{
  "success": true,
  "url": "https://example.com",
  "totalLinks": 42,
  "links": [
    "https://example.com",
    "https://example.com/about",
    "https://example.com/contact",
    ...
  ]
}
```

### Example with cURL

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Health Check

```bash
curl http://localhost:3000/health
```

## How It Works

1. **URL Normalization**: Accepts URLs with or without protocol, normalizes them
2. **Robots.txt Check**: Fetches and parses robots.txt to find sitemaps and respect crawl rules
3. **Sitemap Parsing**: Extracts links from sitemap files found in robots.txt
4. **Page Rendering**: Uses Puppeteer to render pages and wait for dynamic content
5. **Link Extraction**: Finds links from:
   - Anchor tags (`<a href>`)
   - Data attributes (`data-href`, `data-url`, `data-link`)
6. **Depth Crawling**: Recursively crawls found links up to depth 2
7. **Filtering**: Only keeps valid URLs from the same domain

## Configuration

- **Max Depth**: Set to 2 (configurable in `src/crawler.js`)
- **Port**: Default 3000 (configurable via `PORT` environment variable)
- **Timeout**: 30 seconds per page

## Docker

The Dockerfile includes all necessary dependencies for Puppeteer to run in a headless environment.

## License

MIT

