#!/usr/bin/env bash
#
# Posts a comment to the GitHub issue that triggered the workflow.
# Usage: echo "comment body in markdown" | ./scripts/post-issue-comment.sh
#
# The issue number is read from the workflow event payload (not an argument),
# so this can only ever comment on the issue that triggered the run.

set -euo pipefail

ISSUE=$(jq -r '.issue.number // empty' "${GITHUB_EVENT_PATH:?GITHUB_EVENT_PATH not set}")
if ! [[ "$ISSUE" =~ ^[0-9]+$ ]]; then
  echo "Error: no issue number in event payload" >&2
  exit 1
fi

REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"

gh issue comment "$ISSUE" --repo "$REPO" --body-file -
