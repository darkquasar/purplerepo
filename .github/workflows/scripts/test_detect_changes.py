#!/usr/bin/env python3
"""
Test script for the repo change detector
"""

import os
import sys
import tempfile
import yaml

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from detect_repo_changes import RepoChangeDetector, RepoEntry


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
            tags=["tag1", "tag2"],
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
            tags=["tag1", "tag2"],
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
            tags=["new-tag1", "new-tag2"],
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
  - repo_url: https://github.com/test/repo3
    initial_tags:
      - legacy-tag1
    tags:
      - new-tag1
      - legacy-tag1
    contributor_name: mixed-contributor
"""
    
    detector = RepoChangeDetector()
    entries = detector.parse_yaml_content(test_yaml)
    
    print(f"Parsed {len(entries)} entries:")
    for entry in entries:
        print(f"  - {entry.repo_url}")
        print(f"    Tags: {entry.tags}")
        print(f"    Contributor: {entry.contributor_name}")
    
    assert len(entries) == 3
    assert entries[0].repo_url == "https://github.com/test/repo1"
    assert set(entries[0].tags) == {"tag1", "tag2"}  # Should merge initial_tags
    assert entries[1].repo_url == "https://github.com/test/repo2"
    assert set(entries[1].tags) == {"tag3", "tag4"}  # Regular tags
    assert entries[2].repo_url == "https://github.com/test/repo3"
    assert set(entries[2].tags) == {"legacy-tag1", "new-tag1"}  # Should merge and deduplicate
    
    print("✅ Test passed!")


def test_consolidation():
    """Test URL consolidation functionality"""
    print("\nTesting URL consolidation...")
    
    # Create entries with duplicate URLs
    entries = [
        RepoEntry(
            repo_url="https://github.com/duplicate/repo",
            tags=["tag1", "tag2"],
            contributor_name="contributor1"
        ),
        RepoEntry(
            repo_url="https://github.com/duplicate/repo",
            tags=["tag2", "tag3"],  # tag2 is duplicate, should be deduplicated
            contributor_name="contributor2"
        ),
        RepoEntry(
            repo_url="https://github.com/unique/repo",
            tags=["unique-tag"],
            contributor_name="unique-contributor"
        ),
        RepoEntry(
            repo_url="https://github.com/duplicate/repo",
            tags=["tag4"],
            contributor_name="contributor3"
        )
    ]
    
    detector = RepoChangeDetector()
    consolidated = detector.consolidate_entries_by_url(entries)
    
    print(f"Consolidated {len(entries)} entries into {len(consolidated)} entries:")
    for entry in consolidated:
        print(f"  - {entry.repo_url}")
        print(f"    Contributors: {entry.contributor_name}")
        print(f"    Tags: {entry.tags}")
    
    # Assertions
    assert len(consolidated) == 2  # Should have 2 unique URLs
    
    # Find the consolidated duplicate entry
    duplicate_entry = next(e for e in consolidated if e.repo_url == "https://github.com/duplicate/repo")
    unique_entry = next(e for e in consolidated if e.repo_url == "https://github.com/unique/repo")
    
    # Check consolidated contributors
    assert duplicate_entry.contributor_name == "contributor1, contributor2, contributor3"
    assert unique_entry.contributor_name == "unique-contributor"
    
    # Check consolidated tags (should be deduplicated)
    assert set(duplicate_entry.tags) == {"tag1", "tag2", "tag3", "tag4"}
    assert unique_entry.tags == ["unique-tag"]
    
    print("✅ Test passed!")


def test_conflict_detection():
    """Test action conflict detection"""
    print("\nTesting conflict detection...")
    
    # Create entries that conflict (same URL in both add and remove)
    new_repos = [
        RepoEntry(
            repo_url="https://github.com/conflict/repo",
            tags=["new-tag"],
            contributor_name="new-contributor"
        ),
        RepoEntry(
            repo_url="https://github.com/safe/repo",
            tags=["safe-tag"],
            contributor_name="safe-contributor"
        )
    ]
    
    removed_repos = [
        RepoEntry(
            repo_url="https://github.com/conflict/repo",
            tags=["old-tag"],
            contributor_name="old-contributor"
        ),
        RepoEntry(
            repo_url="https://github.com/other/repo",
            tags=["other-tag"],
            contributor_name="other-contributor"
        )
    ]
    
    detector = RepoChangeDetector()
    filtered_new, filtered_removed = detector.detect_action_conflicts(new_repos, removed_repos)
    
    print(f"Filtered new repos: {len(filtered_new)}")
    for repo in filtered_new:
        print(f"  + {repo.repo_url}")
    
    print(f"Filtered removed repos: {len(filtered_removed)}")
    for repo in filtered_removed:
        print(f"  - {repo.repo_url}")
    
    # Assertions
    assert len(filtered_new) == 1  # Should remove the conflicting URL
    assert len(filtered_removed) == 1  # Should remove the conflicting URL
    assert filtered_new[0].repo_url == "https://github.com/safe/repo"
    assert filtered_removed[0].repo_url == "https://github.com/other/repo"
    
    print("✅ Test passed!")


if __name__ == "__main__":
    print("Running tests for repo change detector...\n")
    
    try:
        test_yaml_parsing()
        test_find_changes()
        test_consolidation()
        test_conflict_detection()
        
        print("\n🎉 All tests passed!")
        print("\nTo test with real git data, ensure you're in a git repository with the target file.")
        print("Then run:")
        print("  python detect_repo_changes.py --old-sha <old_commit_sha> --new-sha <new_commit_sha>")
        print("  python detect_repo_changes.py --old-sha HEAD~1 --new-sha HEAD")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        print("\nNote: Some tests may fail if not run in a git repository.")
        print("The core functionality tests should still pass.")
