#!/usr/bin/env bash
set -euo pipefail

echo "🚨 Secret history purge starting (make sure you have a backup clone!)."

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "Installing git-filter-repo via pip (requires Python/pip)..."
  pip install git-filter-repo || { echo "Install failed"; exit 1; }
fi

TARGET_BRANCH=${1:-main}

echo "🔎 Removing committed .env file across history (if present)..."
git filter-repo --invert-paths --path .env || true

if [ -f secret-replacements.txt ]; then
  echo "🔁 Applying token replacements from secret-replacements.txt ..."
  git filter-repo --replace-text secret-replacements.txt || true
else
  echo "ℹ️  secret-replacements.txt not found, skipping replacements phase."
fi

echo "🧹 Pruning original refs & garbage collecting..."
rm -rf .git/refs/original/ || true
git reflog expire --all --expire=now || true
git gc --prune=now --aggressive || true

echo "✅ Local rewrite complete. Force pushing (with lease) to ${TARGET_BRANCH}..."
git push --force-with-lease origin ${TARGET_BRANCH}

echo "🔐 IMPORTANT: Ensure all exposed credentials are rotated and invalidated."
echo "🔍 Run validation scans:"
echo "   git grep -I 'sk-' HEAD || true"
echo "   git grep -I 'ghp_' HEAD || true"
echo "   npm run secrets:scan"
echo "Done."
