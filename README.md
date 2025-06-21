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

## Contributing to PurpleRepo

We welcome contributions to expand and improve our curated list of cybersecurity repositories! 🎉

### 🚀 Quick Start for Contributors

#### 1. Development Setup
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/purplerepo.git
cd purplerepo

# Install dependencies (includes pre-commit hooks)
uv sync --dev

# Install pre-commit hooks
uv run pre-commit install
```

#### 2. Adding New Repositories
Edit `repo-list.yaml` and add your entry:

```yaml
- repo_url: https://github.com/user/repository
  tags:
    - github-repo
    - offensive-tradecraft
    - relevant-category
  contributor_name: YourGitHubUsername
```

#### 3. Test Your Changes Locally
```bash
# Run validation checks
uv run pre-commit run --all-files

# If all checks pass, commit your changes
git add repo-list.yaml
git commit -m "Add awesome-security-tool repository"
git push origin your-branch-name
```

### 📋 Validation Rules

Your contributions must follow these rules (automatically enforced):

#### **Repository Entry Format**
- ✅ **`repo_url`**: Valid GitHub or Gist HTTPS URL
- ✅ **`tags`**: List of 1-6 descriptive tags
- ✅ **`contributor_name`**: Your GitHub username (required)

#### **Tag Guidelines**
- ✅ **Format**: Lowercase with hyphens (e.g., `offensive-tradecraft`)
- ✅ **Count**: Maximum 6 tags per repository
- ✅ **Examples**: `github-repo`, `defensive-tradecraft`, `malware-analysis`, `cloud-security`

#### **Change Limits**
- ✅ **Maximum 5 repositories** can be added/removed per Pull Request
- ✅ **No duplicate URLs** allowed
- ✅ **Valid YAML syntax** required

### 🏷️ Recommended Tags

Use these standardized tags to categorize repositories:

**Primary Categories:**
- `offensive-tradecraft` - Red team, penetration testing, attack tools
- `defensive-tradecraft` - Blue team, detection, defense tools
- `threat-hunting` - Threat hunting methodologies and tools
- `dfir` - Digital forensics and incident response
- `malware-analysis` - Malware analysis and reverse engineering
- `osint` - Open source intelligence gathering
- `cloud-security` - Cloud security tools and resources

**Technology/Platform:**
- `azure`, `aws-cloud`, `kubernetes`, `docker`
- `windows`, `linux`, `macos`
- `powershell`, `python`, `golang`

**Tool Types:**
- `tradecraft-tool`, `detection-engineering`, `automation`
- `ai-llm`, `machine-learning`, `data-analytics`

### 🔄 Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b add-security-tool`
3. **Add** your repositories to `repo-list.yaml`
4. **Test** locally: `uv run pre-commit run --all-files`
5. **Commit** with clear message: `git commit -m "Add XYZ security tool"`
6. **Push** to your fork: `git push origin add-security-tool`
7. **Open** a Pull Request with description of changes

### ✅ Automated Validation

Every Pull Request automatically validates:

#### **Pre-commit Hooks (Local)**
- YAML syntax validation
- Required fields check
- Tag format validation
- Duplicate URL detection
- File formatting

#### **GitHub Actions (PR)**
- All pre-commit validations
- Change limit enforcement (max 5 changes)
- Detailed error reporting in PR comments

### 🛠️ Troubleshooting

#### **Pre-commit Hook Failures**
```bash
# Fix validation errors and try again
uv run pre-commit run --all-files

# Skip hooks only if absolutely necessary
git commit --no-verify -m "Emergency commit"
```

#### **Common Validation Errors**
- **"Too many tags"**: Reduce to 6 or fewer tags
- **"Invalid tag format"**: Use lowercase with hyphens
- **"Duplicate URL"**: Check if repository already exists
- **"Missing contributor_name"**: Add your GitHub username
- **"Too many changes"**: Split into multiple PRs with ≤5 changes each

#### **Testing Changes**
```bash
# Test specific file
uv run pre-commit run --files repo-list.yaml

# Test all files
uv run pre-commit run --all-files

# Update pre-commit hooks
uv run pre-commit autoupdate
```

### 📝 Repository Guidelines

#### **Relevance Criteria**
Repositories should be relevant to:
- Cybersecurity (offensive/defensive)
- Digital forensics and incident response
- Threat intelligence and hunting
- Security automation and tooling
- AI/ML for security applications
- Cloud security and DevSecOps

#### **Quality Standards**
- Active or historically significant projects
- Clear documentation and README
- Legitimate security research/tools
- No malicious or illegal content

### 🤝 Code of Conduct

- Be respectful and professional in all interactions
- Provide constructive feedback and suggestions
- Help maintain high-quality, relevant content
- Follow the established contribution guidelines

### 🆘 Getting Help

- **Validation Issues**: Check the PR comments for detailed error messages
- **Questions**: Open an issue with the `question` label
- **Bug Reports**: Open an issue with the `bug` label
- **Feature Requests**: Open an issue with the `enhancement` label

Thank you for helping make PurpleRepo a valuable resource for the cybersecurity community! 🛡️⚔️

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
