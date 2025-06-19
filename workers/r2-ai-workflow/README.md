# R2 AI Workflow API

A Cloudflare Workers application that provides a structured API for managing GitHub repositories, R2 object storage, and AI-powered content summarization workflows.

## Features

- **GitHub Repository Queue**: Add GitHub repository URLs to a Cloudflare queue for processing
- **R2 File Storage**: Upload files to Cloudflare R2 object storage
- **AI Content Summarization**: Use Cloudflare Workers AI to summarize text content
- **Combined Workflow**: Upload files to R2 and generate AI summaries in a single operation
- **OpenAPI Documentation**: Auto-generated Swagger UI documentation
- **Structured Logging**: Comprehensive logging with tslog
- **Type Safety**: Full TypeScript support with Zod validation

## Architecture

The application follows a clean, modular architecture:

```
src/
├── schemas/          # Zod schemas for request/response validation
├── services/         # Business logic and external service integrations
├── routes/           # API route handlers organized by feature
└── index.ts         # Main application entry point
```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### GitHub Integration
- `POST /api/github/add-repo` - Add GitHub repository to processing queue

### R2 Storage
- `POST /api/r2/upload` - Upload file to R2 object storage

### AI Services
- `POST /api/ai/summarize` - Summarize content using Workers AI

### Workflows
- `POST /api/workflow/trigger` - Start a Cloudflare Workflow for upload and summarization
- `GET /api/workflow/status/{workflowId}` - Check the status of a running workflow

### Documentation
- `GET /docs` - Swagger UI documentation
- `GET /api/openapi.json` - OpenAPI specification

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Cloudflare resources:**
   
   Before deploying, you'll need to create the following Cloudflare resources:
   
   - **R2 Bucket**: Create an R2 bucket named `r2-ai-workflow-bucket`
   - **Queue**: Create a queue named `queue-github-parsing`
   - **Workers AI**: Ensure Workers AI is enabled on your account

3. **Update configuration:**
   
   Edit `wrangler.toml` to match your Cloudflare account settings:
   - Update the R2 bucket name if different
   - Update the queue name if different
   - Ensure the AI binding is correctly configured

4. **Deploy:**
   ```bash
   npm run deploy
   ```

## Development

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Generate types:**
   ```bash
   npm run cf-typegen
   ```

## Usage Examples

### Add GitHub Repository to Queue

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/github/add-repo \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/user/repo",
    "priority": "high"
  }'
```

### Upload File to R2

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/r2/upload \
  -H "Content-Type: application/json" \
  -d '{
    "key": "documents/example.txt",
    "content": "This is the file content",
    "contentType": "text/plain"
  }'
```

### Summarize Content

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Long text content to be summarized...",
    "maxLength": 100,
    "language": "en"
  }'
```

### Trigger Cloudflare Workflow

```bash
# Start a workflow
curl -X POST https://your-worker.your-subdomain.workers.dev/api/workflow/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "key": "documents/article.txt",
    "content": "Long article content...",
    "contentType": "text/plain",
    "maxSummaryLength": 150,
    "language": "en"
  }'

# Check workflow status (use the workflowId from the response above)
curl https://your-worker.your-subdomain.workers.dev/api/workflow/status/{workflowId}
```

## Configuration

### Environment Variables

The application uses Cloudflare Workers bindings instead of traditional environment variables:

- `AI` - Workers AI binding
- `R2_BUCKET` - R2 bucket binding
- `GITHUB_QUEUE` - Queue binding for GitHub processing

### Wrangler Configuration

Key configuration in `wrangler.toml`:

```toml
[ai]
binding = "AI"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "r2-ai-workflow-bucket"

[queues]
[[queues.producers]]
binding = "GITHUB_QUEUE"
queue = "queue-github-parsing"
```

## Design Principles

- **Simplicity**: Clean, readable code without over-engineering
- **Modularity**: Clear separation of concerns with dedicated service classes
- **Type Safety**: Full TypeScript coverage with runtime validation
- **Documentation**: Auto-generated OpenAPI documentation
- **Observability**: Structured logging for monitoring and debugging
- **Standards**: RESTful API design with consistent response formats

## Dependencies

- **Hono**: Fast web framework for Cloudflare Workers
- **@hono/zod-openapi**: OpenAPI integration with Zod validation
- **@hono/swagger-ui**: Swagger UI for API documentation
- **Zod**: Runtime type validation and schema definition
- **tslog**: Structured logging library

## License

This project is licensed under the MIT License.
