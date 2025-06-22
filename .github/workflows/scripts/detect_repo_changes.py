#!/usr/bin/env python3
"""
GitHub Action Python script to detect changes in repo-list.yaml
and prepare JSON payloads for new repository entries.
"""

import os
import sys
import json
import yaml
from typing import Dict, List, Any, Optional
import argparse
from dataclasses import dataclass

try:
    import git
except ImportError:
    print("GitPython is required. Install it with: pip install GitPython")
    sys.exit(1)

try:
    from loguru import logger
except ImportError:
    print("loguru is required. Install it with: pip install loguru")
    sys.exit(1)


@dataclass
class RepoEntry:
    """Represents a repository entry from repo-list.yaml"""
    repo_url: str
    tags: Optional[List[str]] = None
    contributor_name: str = ""
    
    def to_dict(self, action: str = "add") -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = {
            "repo_url": self.repo_url,
            "contributor_name": self.contributor_name,
            "action": action
        }
        
        if self.tags:
            result["tags"] = self.tags
            
        return result


class RepoChangeDetector:
    """Detects changes in repo-list.yaml between commits"""
    
    def __init__(self, repo_path: str = "."):
        """Initialize with path to git repository"""
        try:
            self.repo = git.Repo(repo_path)
            logger.debug(f"Initialized git repository at {repo_path}")
        except git.InvalidGitRepositoryError:
            logger.error(f"Error: {repo_path} is not a valid git repository")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Error initializing git repository: {e}")
            sys.exit(1)
    
    def fetch_file_content(self, sha: str, file_path: str = "repo-list.yaml") -> Optional[str]:
        """Fetch file content from git at specific commit SHA"""
        try:
            # Get the commit object
            commit = self.repo.commit(sha)
            
            # Get the file content at that commit
            blob = commit.tree / file_path
            return blob.data_stream.read().decode('utf-8')
            
        except git.BadName:
            logger.error(f"Invalid commit SHA '{sha}'")
            return None
        except KeyError:
            logger.error(f"File '{file_path}' not found in commit {sha}")
            return None
        except Exception as e:
            logger.error(f"Error fetching file content: {e}")
            return None
    
    def parse_yaml_content(self, yaml_content: str) -> List[RepoEntry]:
        """Parse YAML content and return list of RepoEntry objects"""
        try:
            data = yaml.safe_load(yaml_content)
            repos = data.get('repos', [])
            
            repo_entries = []
            for repo in repos:
                # Handle legacy initial_tags by merging with tags
                tags = repo.get('tags', []) or []
                initial_tags = repo.get('initial_tags', []) or []
                
                # Merge and deduplicate tags
                all_tags = list(set(tags + initial_tags)) if (tags or initial_tags) else None
                
                entry = RepoEntry(
                    repo_url=repo.get('repo_url', ''),
                    tags=all_tags,
                    contributor_name=repo.get('contributor_name', '')
                )
                repo_entries.append(entry)
            
            return repo_entries
            
        except yaml.YAMLError as e:
            logger.error(f"Error parsing YAML: {e}")
            return []
    
    def find_new_entries(self, old_entries: List[RepoEntry], new_entries: List[RepoEntry]) -> List[RepoEntry]:
        """Find entries that exist in new_entries but not in old_entries"""
        old_urls = {entry.repo_url for entry in old_entries}
        new_repos = [entry for entry in new_entries if entry.repo_url not in old_urls]
        return new_repos
    
    def find_removed_entries(self, old_entries: List[RepoEntry], new_entries: List[RepoEntry]) -> List[RepoEntry]:
        """Find entries that exist in old_entries but not in new_entries"""
        new_urls = {entry.repo_url for entry in new_entries}
        removed_repos = [entry for entry in old_entries if entry.repo_url not in new_urls]
        return removed_repos
    
    def consolidate_entries_by_url(self, entries: List[RepoEntry]) -> List[RepoEntry]:
        """Consolidate multiple entries with same URL into single entries with merged data"""
        if not entries:
            return []
        
        # Group entries by URL
        url_groups = {}
        for entry in entries:
            if entry.repo_url not in url_groups:
                url_groups[entry.repo_url] = []
            url_groups[entry.repo_url].append(entry)
        
        consolidated = []
        for repo_url, group in url_groups.items():
            if len(group) == 1:
                # Single entry, no consolidation needed
                consolidated.append(group[0])
            else:
                # Multiple entries for same URL, consolidate them
                logger.info(f"Consolidating {len(group)} entries for URL: {repo_url}")
                
                # Collect all contributors
                contributors = [entry.contributor_name for entry in group if entry.contributor_name]
                unique_contributors = list(dict.fromkeys(contributors))  # Preserve order, remove duplicates
                consolidated_contributor = ", ".join(unique_contributors)
                
                # Collect and merge all tags
                all_tags = []
                for entry in group:
                    if entry.tags:
                        all_tags.extend(entry.tags)
                
                # Deduplicate tags while preserving order
                unique_tags = list(dict.fromkeys(all_tags)) if all_tags else None
                
                # Create consolidated entry
                consolidated_entry = RepoEntry(
                    repo_url=repo_url,
                    tags=unique_tags,
                    contributor_name=consolidated_contributor
                )
                consolidated.append(consolidated_entry)
                
                logger.info(f"  Consolidated contributors: {consolidated_contributor}")
                logger.info(f"  Consolidated tags: {unique_tags}")
        
        return consolidated
    
    def detect_action_conflicts(self, new_repos: List[RepoEntry], removed_repos: List[RepoEntry]) -> tuple[List[RepoEntry], List[RepoEntry]]:
        """Detect URLs that appear in both add and remove lists, return filtered lists"""
        new_urls = {entry.repo_url for entry in new_repos}
        removed_urls = {entry.repo_url for entry in removed_repos}
        
        # Find conflicting URLs
        conflicting_urls = new_urls.intersection(removed_urls)
        
        if conflicting_urls:
            logger.warning(f"Found {len(conflicting_urls)} URL(s) with conflicting actions (both add and remove):")
            for url in conflicting_urls:
                logger.warning(f"  Conflicting URL: {url} - Skipping this URL from all actions")
        
        # Filter out conflicting URLs from both lists
        filtered_new_repos = [entry for entry in new_repos if entry.repo_url not in conflicting_urls]
        filtered_removed_repos = [entry for entry in removed_repos if entry.repo_url not in conflicting_urls]
        
        return filtered_new_repos, filtered_removed_repos
    
    def detect_changes(self, old_sha: str, new_sha: str, file_path: str = "repo-list.yaml", enforce_limits: bool = False) -> List[Dict[str, Any]]:
        """Main method to detect changes and return JSON payloads for new entries"""
        logger.info(f"Comparing {file_path} between {old_sha} and {new_sha}")
        
        # Fetch old version
        old_content = self.fetch_file_content(old_sha, file_path)
        if old_content is None:
            logger.error("Failed to fetch old file content")
            return []
        
        # Fetch new version
        new_content = self.fetch_file_content(new_sha, file_path)
        if new_content is None:
            logger.error("Failed to fetch new file content")
            return []
        
        # Parse both versions
        old_entries = self.parse_yaml_content(old_content)
        new_entries = self.parse_yaml_content(new_content)
        
        logger.info(f"Old version has {len(old_entries)} entries")
        logger.info(f"New version has {len(new_entries)} entries")
        
        # Find new and removed entries
        new_repos = self.find_new_entries(old_entries, new_entries)
        removed_repos = self.find_removed_entries(old_entries, new_entries)
        
        if not new_repos and not removed_repos:
            logger.info("No repository entry changes found")
            return []
        
        logger.info(f"Found {len(new_repos)} new entries and {len(removed_repos)} removed entries before consolidation")
        
        # Check for action conflicts (URLs that appear in both add and remove)
        new_repos, removed_repos = self.detect_action_conflicts(new_repos, removed_repos)
        
        # Consolidate entries by URL to handle duplicates
        consolidated_new_repos = self.consolidate_entries_by_url(new_repos)
        consolidated_removed_repos = self.consolidate_entries_by_url(removed_repos)
        
        if not consolidated_new_repos and not consolidated_removed_repos:
            logger.info("No repository entry changes found after consolidation and conflict resolution")
            return []
        
        # Enforce change limits if requested (for PR/push validation)
        if enforce_limits:
            total_changes = len(consolidated_new_repos) + len(consolidated_removed_repos)
            if total_changes > 15:
                logger.error(f"Too many changes in single commit/PR: {total_changes} (maximum: 15)")
                logger.error(f"  - New entries: {len(consolidated_new_repos)}")
                logger.error(f"  - Removed entries: {len(consolidated_removed_repos)}")
                logger.error("Please split your changes into smaller commits with max 15 changes each.")
                raise ValueError(f"Exceeded maximum change limit: {total_changes} > 15")
        
        # Convert to JSON payloads
        payloads = []
        
        # Handle new entries
        if consolidated_new_repos:
            logger.info(f"Processing {len(consolidated_new_repos)} consolidated new repository entries:")
            for repo in consolidated_new_repos:
                payload = repo.to_dict(action="add")
                payloads.append(payload)
                logger.info(f"  + {repo.repo_url} (contributor: {repo.contributor_name})")
        
        # Handle removed entries
        if consolidated_removed_repos:
            logger.info(f"Processing {len(consolidated_removed_repos)} consolidated removed repository entries:")
            for repo in consolidated_removed_repos:
                payload = repo.to_dict(action="remove")
                payloads.append(payload)
                logger.info(f"  - {repo.repo_url} (contributor: {repo.contributor_name})")
        
        return payloads


def main():
    """Main function to run the script"""
    parser = argparse.ArgumentParser(description='Detect changes in repo-list.yaml')
    parser.add_argument('--old-sha', required=True, help='Old commit SHA')
    parser.add_argument('--new-sha', required=True, help='New commit SHA')
    parser.add_argument('--file-path', default='repo-list.yaml', help='Path to the YAML file to check')
    parser.add_argument('--repo-path', default='.', help='Path to the git repository')
    parser.add_argument('--output-file', help='Output file for JSON payloads')
    parser.add_argument('--enforce-limits', action='store_true', help='Enforce maximum 15 changes per commit/PR')
    
    args = parser.parse_args()
    
    logger.info(f"Checking for changes in {args.file_path}")
    logger.info(f"Comparing commits: {args.old_sha} -> {args.new_sha}")
    
    # Initialize detector
    detector = RepoChangeDetector(args.repo_path)
    
    # Detect changes
    try:
        payloads = detector.detect_changes(args.old_sha, args.new_sha, args.file_path, enforce_limits=args.enforce_limits)
    except ValueError as e:
        logger.error(f"Validation failed: {e}")
        sys.exit(1)
    
    if not payloads:
        logger.info("No changes detected or no new entries found")
        # Set GitHub Actions output to indicate no changes
        if os.getenv('GITHUB_ACTIONS'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
                f.write("has_changes=false\n")
                f.write("payloads_count=0\n")
        sys.exit(0)
    
    # Output results
    logger.info(f"Generated {len(payloads)} JSON payload(s):")
    
    # Pretty print each payload
    for i, payload in enumerate(payloads, 1):
        logger.info(f"Payload {i}:")
        logger.info(json.dumps(payload, indent=2))
    
    # Save to file if specified
    if args.output_file:
        with open(args.output_file, 'w') as f:
            json.dump(payloads, f, indent=2)
        logger.info(f"Payloads saved to {args.output_file}")
    
    # Set GitHub Actions outputs
    if os.getenv('GITHUB_ACTIONS'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
            f.write("has_changes=true\n")
            f.write(f"payloads_count={len(payloads)}\n")
            f.write(f"payloads={json.dumps(payloads)}\n")
    
    logger.success(f"Script completed successfully. Found {len(payloads)} repository entry changes.")


if __name__ == "__main__":
    main()
