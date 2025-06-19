# PurpleRepo

Introducing PurpleRepo, a curated list of repositories for offensive and defensive cyber tradecraft 🎉

[https://hunt.quasarops.com](https://hunt.quasarops.com)

You know how tedious it is to find that one awesome GitHub Project that exploited vulnerability XYZ, or allowed you to collect DFIR data for a new artifact, or a package that orchestrates a boring task specific to a technology or platform. 😓

It's hard to keep track of it all, even when encapsulated in "awesome" style repos. 🤯

🚀 **PurpleRepo helps you by allowing you to:**

👉🏼 capture repos on the fly in different ways
👉🏼 capture their metadata using the GitHub API
👉🏼 summarize their READMEs using Cloudflare AI
👉🏼 Sync and Update based on cron schedules or specific triggers
👉🏼 Keep them up to date to understand which ones are active or not.

This was all built on free-tier Cloudflare infrastructure, it's all workers in the backend. ☁️

The API will be made available soon so it can be integrated into automation or agentic workflows. 🤖

## About This Repository (`purplerepo`)

This repository hosts the curated list of cybersecurity-related GitHub projects (`repo-list.yaml`) that powers the PurpleRepo application. Your contributions here directly enhance the data available through `hunt.quasarops.com`.

## Contribution Guidelines

We welcome contributions to expand and improve our list of repositories! Here's how you can help:

### Adding New Repositories

To add a new repository, please edit the `repo-list.yaml` file and submit a Pull Request (PR). Each entry should follow this format:

```yaml
- repo_url: https://github.com/user/repository
  initial_tags:
    - tag1
    - tag2
    - relevant-category
  contributor_name: YourGitHubUsername
```

**Guidelines for adding repositories:**

1.  **Relevance:** Ensure the repository is relevant to cybersecurity (offensive, defensive, DFIR, threat intelligence, GenAI, automation, etc.).
2.  **`repo_url`**: Provide the full HTTPS URL to the GitHub repository.
3.  **`initial_tags`**:
    *   Include descriptive tags.
    *   Use lowercase and hyphens for multi-word tags (e.g., `offensive-tradecraft`, `dfir-tool`).
    *   Consider tags like `github-repo`, `offensive-tradecraft`, `defensive-tradecraft`, `detection-engineering`, `malware-analysis`, `osint`, `cloud-security`, etc.
    *   Add at least one tag indicating the primary domain (e.g., `offensive`, `defensive`, `forensics`).
4.  **`contributor_name`**: Add your GitHub username so we can give you credit!

### Reporting Issues or Suggesting Enhancements

If you find an issue with an existing entry (e.g., broken link, incorrect tags) or have suggestions for improving the repository or the contribution process, please open an issue on GitHub.

### Pull Request Process

1.  Fork the repository.
2.  Create a new branch for your changes (e.g., `git checkout -b add-awesome-repo`).
3.  Make your changes in your branch.
    *   If adding a new repository, add it to `repo-list.yaml`.
    *   Ensure your YAML syntax is correct.
4.  Commit your changes with a clear and descriptive commit message.
5.  Push your changes to your fork.
6.  Open a Pull Request to the `main` branch of this repository.
7.  In your PR description, briefly explain the changes you've made. If you added new repositories, list them.

### Code of Conduct

While this repository primarily manages a data file, we expect all contributors to adhere to a high standard of respect and professionalism. Please be courteous and constructive in all interactions. (A more formal Code of Conduct may be added later if needed).

Thank you for helping make PurpleRepo a valuable resource for the cybersecurity community!

# Repository Change Detection System

This system automatically detects when new repositories are added to `repo-list.yaml` and sends JSON payloads to a Cloudflare Worker for processing.

## Components

### 1. Python Script (`detect_repo_changes.py`)

The main script that:
- Uses GitPython to fetch `repo-list.yaml` content from two different commit SHAs
- Compares the files to identify new repository entries
- Converts new entries to JSON format for the Cloudflare Worker

### 2. GitHub Action (`.github/workflows/detect-repo-changes.yml`)

Automatically runs when:
- There's a push to the `main` branch
- The `repo-list.yaml` file has been modified

The workflow:
1. Checks out the repository with `fetch-depth: 2` to get current and previous commits
2. Determines the old and new commit SHAs using git commands
3. Runs the Python script to detect changes using local git repository
4. Sends JSON payloads to the Cloudflare Worker

### 3. Test Script (`test_detect_changes.py`)

Provides unit tests for the core functionality.

## Setup Instructions

### 1. Repository Secrets

Add these secrets to your GitHub repository:

- `CLOUDFLARE_WORKER_URL`: The URL of your Cloudflare Worker endpoint
- `CLOUDFLARE_WORKER_TOKEN`: Authentication token for your Cloudflare Worker

### 2. Cloudflare Worker Setup

Your Cloudflare Worker should expect JSON payloads in this format:

```json
{
  "repo_url": "https://github.com/example/repo",
  "initial_tags": ["tag1", "tag2"],
  "contributor_name": "contributor_name"
}
```

Or:

```json
{
  "repo_url": "https://github.com/example/repo",
  "tags": ["tag1", "tag2"],
  "contributor_name": "contributor_name"
}
```

### 3. Local Testing

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run tests:
   ```bash
   python test_detect_changes.py
   ```

3. Test with real data (requires being in a git repository):
   ```bash
   python detect_repo_changes.py --old-sha <old_commit> --new-sha <new_commit>
   # Or use relative references:
   python detect_repo_changes.py --old-sha HEAD~1 --new-sha HEAD
   ```

## How It Works

### Detection Process

1. **Trigger**: Push to main branch with changes to `repo-list.yaml`
2. **Checkout**: GitHub Action checks out repository with `fetch-depth: 2`
3. **Fetch**: Python script uses GitPython to read file content from both commits
4. **Parse**: Convert YAML to structured data
5. **Compare**: Identify repositories that exist in new version but not in old
6. **Convert**: Transform new entries to JSON format
7. **Send**: POST each payload to the Cloudflare Worker

### Key Advantages

- **No GitHub Token Required**: Uses local git repository instead of GitHub API
- **Pythonic**: Uses GitPython library instead of subprocess calls
- **Efficient**: Only fetches the commits needed (fetch-depth: 2)
- **Reliable**: Direct git operations are more reliable than API calls

### Supported YAML Structure

The script handles both `initial_tags` and `tags` fields:

```yaml
repos:
  - repo_url: https://github.com/example/repo1
    initial_tags:
      - github-repo
      - security
    contributor_name: contributor1
    
  - repo_url: https://github.com/example/repo2
    tags:
      - github-repo
      - tools
    contributor_name: contributor2
```

### JSON Output Format

Each new repository entry becomes a separate JSON payload:

```json
{
  "repo_url": "https://github.com/example/repo",
  "initial_tags": ["github-repo", "security"],
  "contributor_name": "contributor_name"
}
```

## Dependencies

- **PyYAML**: For parsing YAML files
- **GitPython**: For git operations (replaces subprocess calls)

## Troubleshooting

### Common Issues

1. **GitPython Installation**: Ensure GitPython is installed: `pip install GitPython`

2. **Git Repository**: The script must be run in a valid git repository

3. **Missing Commits**: Ensure the specified commit SHAs exist in the repository

4. **Missing Secrets**: If `CLOUDFLARE_WORKER_URL` is not set, the workflow will skip sending payloads but still detect changes

5. **YAML Parsing Errors**: Check that your `repo-list.yaml` follows the expected structure

### Debugging

Enable debug output by running tests:

```bash
python test_detect_changes.py
```

### GitHub Actions Debugging

Check the Actions tab in your repository for detailed logs of each workflow run.

## Customization

### Modifying the Script

- **File Path**: Use `--file-path` parameter to specify a different YAML file
- **Repository Path**: Use `--repo-path` parameter if running from outside the git repository
- **Output Format**: Modify the `to_dict()` method in `RepoEntry` class to change JSON structure
- **Additional Fields**: Add new fields to the `RepoEntry` dataclass as needed

### Workflow Customization

- **Trigger Conditions**: Modify the `on` section to change when the workflow runs
- **Worker Authentication**: Adjust the curl command to match your worker's authentication requirements
- **Error Handling**: Add additional error handling steps as needed

## Security Considerations

- No GitHub tokens required for basic operation
- Store sensitive tokens in GitHub Secrets, not in code
- Validate input data before sending to external services
- Consider rate limiting for the Cloudflare Worker endpoint

## Performance Benefits

- **Faster**: No API rate limits since we use local git
- **More Reliable**: Direct git operations vs HTTP requests
- **Simpler**: No authentication required for reading local repository
- **Efficient**: Only fetches the specific commits needed
