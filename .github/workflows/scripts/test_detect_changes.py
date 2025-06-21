#!/usr/bin/env python3
"""
Test script for the repo change detector
"""

import os
import tempfile
import yaml
from .detect_repo_changes import RepoChangeDetector, RepoEntry


def create_test_yaml(repos_data):
    """Create a test YAML content"""
    return yaml.dump({'repos': repos_data}, default_flow_style=False)


def test_find_changes():
    """Test the find_new_entries and find_removed_entries methods"""
    print("Testing change detection methods...")
    
    # Create old entries
    old_entries = [
        RepoEntry(
            repo_url="https://github.com/old/repo1",
            initial_tags=["tag1", "tag2"],
            contributor_name="contributor1"
        ),
        RepoEntry(
            repo_url="https://github.com/old/repo2",
            tags=["tag3", "tag4"],
            contributor_name="contributor2"
        ),
        RepoEntry(
            repo_url="https://github.com/old/repo_to_remove",
            tags=["tag5"],
            contributor_name="old-contributor"
        )
    ]
    
    # Create new entries (some old ones removed, some new ones added)
    new_entries = [
        RepoEntry(
            repo_url="https://github.com/old/repo1",
            initial_tags=["tag1", "tag2"],
            contributor_name="contributor1"
        ),
        # repo2 is kept, repo_to_remove is removed
        RepoEntry(
            repo_url="https://github.com/old/repo2",
            tags=["tag3", "tag4"],
            contributor_name="contributor2"
        ),
        # New entries added
        RepoEntry(
            repo_url="https://github.com/new/repo3",
            initial_tags=["new-tag1", "new-tag2"],
            contributor_name="new-contributor"
        ),
        RepoEntry(
            repo_url="https://github.com/new/repo4",
            tags=["new-tag3"],
            contributor_name="another-contributor"
        )
    ]
    
    # Create detector instance
    detector = RepoChangeDetector()
    
    # Find new entries
    new_repos = detector.find_new_entries(old_entries, new_entries)
    print(f"Found {len(new_repos)} new entries:")
    for repo in new_repos:
        print(f"  + {repo.repo_url} (contributor: {repo.contributor_name})")
        payload = repo.to_dict(action="add")
        print(f"    Payload: {payload}")
    
    # Find removed entries
    removed_repos = detector.find_removed_entries(old_entries, new_entries)
    print(f"Found {len(removed_repos)} removed entries:")
    for repo in removed_repos:
        print(f"  - {repo.repo_url} (contributor: {repo.contributor_name})")
        payload = repo.to_dict(action="remove")
        print(f"    Payload: {payload}")
    
    # Assertions
    assert len(new_repos) == 2
    assert new_repos[0].repo_url == "https://github.com/new/repo3"
    assert new_repos[1].repo_url == "https://github.com/new/repo4"
    
    assert len(removed_repos) == 1
    assert removed_repos[0].repo_url == "https://github.com/old/repo_to_remove"
    
    # Test action field in payloads
    add_payload = new_repos[0].to_dict(action="add")
    remove_payload = removed_repos[0].to_dict(action="remove")
    assert add_payload["action"] == "add"
    assert remove_payload["action"] == "remove"
    
    print("✅ Test passed!")


def test_yaml_parsing():
    """Test YAML parsing functionality"""
    print("\nTesting YAML parsing...")
    
    test_yaml = """
repos:
  - repo_url: https://github.com/test/repo1
    initial_tags:
      - tag1
      - tag2
    contributor_name: test-contributor
  - repo_url: https://github.com/test/repo2
    tags:
      - tag3
      - tag4
    contributor_name: another-contributor
"""
    
    detector = RepoChangeDetector()
    entries = detector.parse_yaml_content(test_yaml)
    
    print(f"Parsed {len(entries)} entries:")
    for entry in entries:
        print(f"  - {entry.repo_url}")
        print(f"    Tags: {entry.initial_tags or entry.tags}")
        print(f"    Contributor: {entry.contributor_name}")
    
    assert len(entries) == 2
    assert entries[0].repo_url == "https://github.com/test/repo1"
    assert entries[0].initial_tags == ["tag1", "tag2"]
    assert entries[1].tags == ["tag3", "tag4"]
    
    print("✅ Test passed!")


if __name__ == "__main__":
    print("Running tests for repo change detector...\n")
    
    try:
        test_yaml_parsing()
        test_find_changes()
        
        print("\n🎉 All tests passed!")
        print("\nTo test with real git data, ensure you're in a git repository with the target file.")
        print("Then run:")
        print("  python detect_repo_changes.py --old-sha <old_commit_sha> --new-sha <new_commit_sha>")
        print("  python detect_repo_changes.py --old-sha HEAD~1 --new-sha HEAD")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        print("\nNote: Some tests may fail if not run in a git repository.")
        print("The core functionality tests should still pass.")
