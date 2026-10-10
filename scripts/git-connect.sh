#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/git-connect.sh OWNER/REPOSITORY [--public|--private]

Examples:
  ./scripts/git-connect.sh IvanMHonemann/gestao-extintores --private
  ./scripts/git-connect.sh minha-organizacao/novo-projeto --private

Prerequisites:
  - git installed
  - GitHub CLI installed
  - gh auth login already completed
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 || $# -gt 2 ]]; then
  usage
  [[ $# -ge 1 ]] || exit 2
  exit 0
fi

repo="$1"
visibility="${2:---private}"
if [[ "$visibility" != "--private" && "$visibility" != "--public" ]]; then
  echo "Visibility must be --private or --public." >&2
  exit 2
fi

if [[ ! "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Repository must use OWNER/REPOSITORY format." >&2
  exit 2
fi

command -v git >/dev/null || { echo "git is required." >&2; exit 1; }
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required." >&2; exit 1; }
gh auth status >/dev/null

branch="$(git branch --show-current)"
[[ -n "$branch" ]] || { echo "Run this script inside a Git repository." >&2; exit 1; }

git status --short
if [[ -n "$(git status --short)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before connecting." >&2
  exit 1
fi

if gh repo view "$repo" >/dev/null 2>&1; then
  echo "Repository exists: $repo"
  git remote remove github 2>/dev/null || true
  git remote add github "https://github.com/$repo.git"
  git push --set-upstream github "$branch"
else
  echo "Creating $visibility repository: $repo"
  gh repo create "$repo" "$visibility" --source=. --remote=github --push
fi

echo
gh repo view "$repo" --json nameWithOwner,isPrivate,defaultBranchRef,url
