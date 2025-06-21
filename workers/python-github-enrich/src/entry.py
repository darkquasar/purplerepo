import json
from urllib.parse import urlparse
import os
from workers import fetch, handler, Request, Response
from js import console

def parse_github_url(url: str) -> tuple[str | None, str | None]:
    """
    Parses a GitHub URL and returns (owner, repo).
    
    Args:
        url: GitHub repository URL (e.g., https://github.com/owner/repo)
        
    Returns:
        Tuple of (owner, repo) or (None, None) if parsing fails
    """
    try:
        parsed = urlparse(url)
        if parsed.hostname != 'github.com':
            return None, None
        
        path_parts = [part for part in parsed.path.split('/') if part]
        if len(path_parts) >= 2:
            return path_parts[0], path_parts[1]
        return None, None
    except Exception:
        return None, None


async def fetch_github_repo_data(owner: str, repo: str, token: str) -> dict:
    """
    Fetches comprehensive repository data from GitHub API.
    
    Args:
        owner: Repository owner username
        repo: Repository name
        token: GitHub Personal Access Token
        
    Returns:
        Dictionary containing all requested repository data
        
    Raises:
        ValueError: If repository is not found
        IOError: If API request fails
    """
    base_url = "https://api.github.com"
    repo_url = f"{base_url}/repos/{owner}/{repo}"
    commits_url = f"{repo_url}/commits?per_page=1"
    
    console.log(f"Fetching repository data for {owner}/{repo}")

    # Try a more standard User-Agent format and use object literal
    auth_header = f"Bearer {token}"
    user_agent = "Mozilla/5.0 (compatible; GitHub-Enricher/2.0; +https://github.com/api-enricher)"
    
    # Fetch main repository data
    try:
        console.log(f"Making request to: {repo_url}")
        console.log("Headers being sent:")
        console.log(f"User-Agent: {user_agent}")
        console.log(f"Accept: application/vnd.github+json")
        
        repo_response = await fetch(repo_url, 
            headers={
                "User-Agent": user_agent,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Authorization": auth_header
            },
            method="GET"
        )
        
        if repo_response.status == 404:
            raise ValueError(f"Repository {owner}/{repo} not found")
        elif repo_response.status == 403:
            error_text = await repo_response.text()
            rate_limit = repo_response.headers.get("X-RateLimit-Remaining")
            console.log(f"Rate limit remaining: {rate_limit}")
            raise IOError(f"GitHub API access forbidden: {error_text}")
        elif not repo_response.ok:
            error_text = await repo_response.text()
            raise IOError(f"GitHub API error {repo_response.status}: {error_text}")
            
        repo_data = await repo_response.json()
        console.log("Successfully fetched repository data")
        
    except Exception as e:
        console.log(f"Error fetching repository data: {e}")
        if isinstance(e, (ValueError, IOError)):
            raise
        raise IOError(f"Failed to fetch repository data: {str(e)}")

    # Fetch latest commit data
    latest_commit = None
    try:
        console.log(f"Fetching latest commit from: {commits_url}")
        commits_response = await fetch(commits_url,
            headers={
                "User-Agent": user_agent,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Authorization": auth_header
            },
            method="GET"
        )
        
        if commits_response.ok:
            commits_data = await commits_response.json()
            if commits_data and isinstance(commits_data, list) and len(commits_data) > 0:
                commit = commits_data[0]
                commit_info = commit.get("commit", {})
                author_info = commit_info.get("author", {})
                
                latest_commit = {
                    "sha": commit.get("sha"),
                    "message": (commit_info.get("message", "")).split('\n')[0],
                    "author": author_info.get("name"),
                    "date": author_info.get("date"),
                    "url": commit.get("html_url")
                }
                console.log("Successfully fetched latest commit data")
        else:
            console.log(f"Failed to fetch commits: {commits_response.status}")
            
    except Exception as e:
        console.log(f"Error fetching commit data: {e}")
        # Continue without commit data rather than failing

    # Extract and structure the required data
    owner_info = repo_data.get("owner", {})
    license_info = repo_data.get("license", {})

    # Build the response with all requested fields
    enriched_data = {
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "project_url": repo_data.get("html_url"),
        "stars": repo_data.get("stargazers_count", 0),
        "forks": repo_data.get("forks_count", 0),
        "open_issues": repo_data.get("open_issues_count", 0),
        "language": repo_data.get("language"),
        "license": license_info.get("name") if license_info else None,
        "topics": repo_data.get("topics", []),
        "created_at": repo_data.get("created_at"),
        "last_pushed_at": repo_data.get("pushed_at"),
        "owner": {
            "login": owner_info.get("login"),
            "avatar_url": owner_info.get("avatar_url"),
        },
        "latest_commit": latest_commit
    }

    return enriched_data


@handler
async def on_fetch(request: Request, env) -> Response:
    """
    Main Cloudflare Worker handler for GitHub repository enrichment.
    
    Expects POST request with JSON body containing:
    {
        "github_url": "https://github.com/owner/repo"
    }
    
    Returns enriched repository data or error response.
    """
    console.log("GitHub enrichment worker started")

    # Only accept POST requests
    if request.method != "POST":
        return Response(
            json.dumps({"error": "Method not allowed. Use POST."}),
            status=405,
            headers={"Content-Type": "application/json"}
        )

    try:
        # Parse request body
        try:
            request_data = await request.json()
        except Exception as e:
            console.log(f"JSON parsing error: {e}")
            return Response(
                json.dumps({"error": "Invalid JSON in request body"}),
                status=400,
                headers={"Content-Type": "application/json"}
            )

        # Validate request structure
        if not isinstance(request_data, dict):
            return Response(
                json.dumps({"error": "Request body must be a JSON object"}),
                status=400,
                headers={"Content-Type": "application/json"}
            )

        # Extract GitHub URL
        github_url = request_data.get("github_url")
        if not github_url:
            return Response(
                json.dumps({"error": "Missing 'github_url' field in request body"}),
                status=400,
                headers={"Content-Type": "application/json"}
            )

        console.log(f"Processing GitHub URL: {github_url}")

        # Parse owner and repository from URL
        owner, repo = parse_github_url(github_url)
        if not owner or not repo:
            return Response(
                json.dumps({
                    "error": "Invalid GitHub URL format. Expected: https://github.com/owner/repo"
                }),
                status=400,
                headers={"Content-Type": "application/json"}
            )

        console.log(f"Parsed repository: {owner}/{repo}")

        # Get GitHub token from environment
        github_token = None
        try:
            # Try different methods to access environment variable
            if env:
                # Method 1: Direct attribute access
                try:
                    github_token = getattr(env, "GITHUB_PAT_PUBLIC", None)
                except Exception:
                    pass
                
                # Method 2: Dictionary access
                if not github_token:
                    try:
                        github_token = env["GITHUB_PAT_PUBLIC"]
                    except (KeyError, TypeError):
                        pass
                
                # Method 3: .get() method if available
                if not github_token and hasattr(env, 'get'):
                    try:
                        github_token = env.get("GITHUB_PAT_PUBLIC")
                    except Exception:
                        pass
            
            # Fallback to os.environ
            if not github_token:
                github_token = os.environ.get("GITHUB_PAT_PUBLIC")
                
        except Exception as e:
            console.log(f"Environment access error: {e}")
            return Response(
                json.dumps({"error": "Failed to access environment variables"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )

        if not github_token:
            console.log("GitHub token not found in environment")
            return Response(
                json.dumps({
                    "error": "GITHUB_PAT_PUBLIC environment variable not configured"
                }),
                status=500,
                headers={"Content-Type": "application/json"}
            )

        console.log("GitHub token found, proceeding with API request")

        # Fetch repository data
        try:
            enriched_data = await fetch_github_repo_data(owner, repo, github_token)
            console.log("Successfully enriched repository data")
            
            return Response(
                json.dumps(enriched_data, indent=2),
                status=200,
                headers={
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            )
            
        except ValueError as e:
            # Repository not found
            console.log(f"Repository not found: {e}")
            return Response(
                json.dumps({"error": str(e)}),
                status=404,
                headers={"Content-Type": "application/json"}
            )
            
        except IOError as e:
            # API access error
            console.log(f"GitHub API error: {e}")
            return Response(
                json.dumps({"error": str(e)}),
                status=502,
                headers={"Content-Type": "application/json"}
            )

    except Exception as e:
        # Catch-all for unexpected errors
        console.log(f"Unexpected error: {type(e).__name__}: {e}")
        return Response(
            json.dumps({
                "error": f"Internal server error: {str(e)}"
            }),
            status=500,
            headers={"Content-Type": "application/json"}
        )
