#!/usr/bin/env bash
set -euo pipefail

# --- Read version from package.json ---
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "Preparing release ${TAG}..."

# --- Check gh CLI is available ---
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed. Install with: brew install gh"
  exit 1
fi

# --- Check we're in a git repo and authenticated ---
gh auth status > /dev/null 2>&1 || {
  echo "Error: Not authenticated with GitHub CLI. Run: gh auth login"
  exit 1
}

# --- Check the tag doesn't already exist on the remote ---
if gh release view "$TAG" > /dev/null 2>&1; then
  echo "Error: Release ${TAG} already exists on GitHub."
  exit 1
fi

# --- Extract changelog section for this version ---
# Grabs everything between "## <VERSION>" and the next "## " heading (or EOF)
NOTES=$(awk -v ver="$VERSION" '
  /^## / {
    if (found) exit
    if (index($0, ver)) { found=1; next }
  }
  found { print }
' CHANGELOG.md)

if [ -z "$NOTES" ]; then
  echo "Warning: No changelog entry found for version ${VERSION} in CHANGELOG.md."
  echo "The release will be created with auto-generated notes instead."
  USE_GENERATED_NOTES=true
else
  # Trim leading/trailing blank lines
  NOTES=$(echo "$NOTES" | awk 'NF {found=1} found' | awk '{lines[NR]=$0} END {for(i=NR;i>=1;i--) if(lines[i]!=""){last=i;break} for(i=1;i<=last;i++) print lines[i]}')
  USE_GENERATED_NOTES=false
fi

# --- Build and package the extension ---
echo "Building extension..."
npm run build

echo "Packaging .vsix..."
npm run package

VSIX_FILE=$(ls -1t *.vsix 2>/dev/null | head -n1)
if [ -z "$VSIX_FILE" ]; then
  echo "Error: No .vsix file found after packaging."
  exit 1
fi

echo "Found package: ${VSIX_FILE}"

# --- Create git tag if it doesn't exist locally ---
if ! git tag -l "$TAG" | grep -q "$TAG"; then
  echo "Creating git tag ${TAG}..."
  git tag "$TAG"
  git push origin "$TAG"
else
  echo "Tag ${TAG} already exists locally."
  git push origin "$TAG" 2>/dev/null || true
fi

# --- Create the GitHub release ---
echo "Creating GitHub release ${TAG}..."

if [ "$USE_GENERATED_NOTES" = true ]; then
  gh release create "$TAG" "$VSIX_FILE" \
    --title "$TAG" \
    --generate-notes
else
  gh release create "$TAG" "$VSIX_FILE" \
    --title "$TAG" \
    --notes "$NOTES"
fi

echo ""
echo "Release ${TAG} created successfully!"
echo "View it at: $(gh release view "$TAG" --json url -q .url)"
