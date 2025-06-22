# Python GitHub Enrich Worker

A Cloudflare Worker that enriches GitHub repository data by fetching comprehensive information from the GitHub API. This worker accepts a GitHub repository URL and returns detailed metadata including stars, forks, commits, license information, and more.

## Features

- Fetches comprehensive repository metadata from GitHub API
- Returns structured data including:
  - Repository statistics (stars, forks, open issues)
  - Owner information and avatar
  - Latest commit details
  - License and topic information
  - Creation and last push dates
- Built with Python Workers on Cloudflare
- Handles error cases gracefully with appropriate HTTP status codes

## Prerequisites

- [Node.js](https://nodejs.org/) (for Wrangler CLI)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- GitHub Personal Access Token (for API access)

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Python environment:**
   ```bash
   uv venv
   uv sync
   ```

3. **Configure your editor:**
   Point your editor's Python plugin at the `.venv` directory for autocomplete and type hints.

4. **Set up GitHub token:**
   Create a GitHub Personal Access Token with `public_repo` scope and configure it as a secret:
   ```bash
   wrangler secret put GITHUB_PAT_PUBLIC
   ```

   **Note:** Ideally, use a purpose-built GitHub account for this purpose, not your main account.

## Development

### Local Development

Start the development server:
```bash
npm run dev
# or
wrangler dev
```

The worker will be available at `http://localhost:8787`

### Testing

Test the worker with a POST request:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"github_url": "https://github.com/octocat/Hello-World"}'
```

Expected response:
```json
{
  "full_name": "octocat/Hello-World",
  "description": "My first repository on GitHub!",
  "project_url": "https://github.com/octocat/Hello-World",
  "stars": 2000,
  "forks": 1000,
  "open_issues": 5,
  "language": "C",
  "license": "MIT License",
  "topics": ["hello-world", "example"],
  "created_at": "2011-01-26T19:01:12Z",
  "last_pushed_at": "2023-01-01T00:00:00Z",
  "owner": {
    "login": "octocat",
    "avatar_url": "https://github.com/images/error/octocat_happy.gif"
  },
  "latest_commit": {
    "sha": "abc123...",
    "message": "Initial commit",
    "author": "The Octocat",
    "date": "2023-01-01T00:00:00Z",
    "url": "https://github.com/octocat/Hello-World/commit/abc123..."
  }
}
```

### Error Handling

The worker handles various error cases:

- **400 Bad Request**: Invalid JSON or missing `github_url` field
- **404 Not Found**: Repository doesn't exist
- **500 Internal Server Error**: Missing GitHub token or unexpected errors
- **502 Bad Gateway**: GitHub API errors (rate limiting, access issues)

## Deployment

### Deploy to Production

```bash
npm run deploy
# or
wrangler deploy
```

### Environment Configuration

The worker requires the following secret:
- `GITHUB_PAT_PUBLIC`: GitHub Personal Access Token with public repository access

Set secrets using:
```bash
wrangler secret put GITHUB_PAT_PUBLIC
```

## API Reference

### Endpoint

`POST /`

### Request Body

```json
{
  "github_url": "https://github.com/owner/repository"
}
```

### Response

Success (200):
```json
{
  "full_name": "string",
  "description": "string",
  "project_url": "string",
  "stars": number,
  "forks": number,
  "open_issues": number,
  "language": "string",
  "license": "string",
  "topics": ["string"],
  "created_at": "string",
  "last_pushed_at": "string",
  "owner": {
    "login": "string",
    "avatar_url": "string"
  },
  "latest_commit": {
    "sha": "string",
    "message": "string",
    "author": "string",
    "date": "string",
    "url": "string"
  }
}
```

Error responses include appropriate HTTP status codes and error messages.

## Security Considerations

### CORS Policy

⚠️ **Important Security Notice**: The current implementation uses `'Access-Control-Allow-Origin': '*'` which allows any domain to access this API from a browser. 

**This should only be used during development.** For production deployments:

1. **Restrict CORS to specific domains:**
   ```python
   "Access-Control-Allow-Origin": "https://yourdomain.com"
   ```

   or 

   ```python
   'Access-Control-Allow-Origin': 'https://your-calling-worker.your-account.workers.dev'
   ```

2. **Remove CORS headers entirely** if the API is only for server-to-server communication

3. **Implement additional security measures:**
   - API key authentication
   - Rate limiting
   - Request origin validation

### Best Practice: Service Bindings

For Worker-to-Worker communication, **service bindings are the recommended approach** instead of HTTP requests with CORS headers. Service bindings provide:

- **Better security**: No CORS configuration needed
- **Better performance**: Direct Worker-to-Worker communication
- **Better reliability**: No network overhead

Configure service bindings in `wrangler.toml`:
```toml
[[services]]
binding = "GITHUB_ENRICHER"
service = "python-github-enrich"
```

Then call from another worker:
```javascript
// In another worker
const response = await env.GITHUB_ENRICHER.fetch(request);
```

## Configuration

### wrangler.toml

Key configuration options:

```toml
name = "python-github-enrich"
main = "src/entry.py"
compatibility_date = "2025-06-06"
compatibility_flags = ["python_workers"]

[observability]
enabled = true
```

### Environment Variables

- `GITHUB_PAT_PUBLIC`: GitHub Personal Access Token (set as secret)

## Project Structure

```
workers/python-github-enrich/
├── src/
│   └── entry.py          # Main worker code
├── package.json          # Node.js dependencies and scripts
├── pyproject.toml        # Python project configuration
├── wrangler.toml         # Cloudflare Worker configuration
└── README.md            # This file
```

## Development Scripts

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to production
- `npm start` - Alias for `npm run dev`

## Dependencies

- **webtypy**: Python Workers runtime library
- **wrangler**: Cloudflare Workers CLI tool

## License

This project is part of the purplerepo monorepo.
