#!/usr/bin/env bash
# =============================================================
#  AquaGuard — GitHub Repository Setup Script
#  Run: chmod +x scripts/github-init.sh && ./scripts/github-init.sh
# =============================================================
set -e

REPO_NAME="aquaguard"
GITHUB_USER=""   # ← set your GitHub username here or pass as $1

if [ -n "$1" ]; then GITHUB_USER="$1"; fi

if [ -z "$GITHUB_USER" ]; then
  read -p "GitHub username: " GITHUB_USER
fi

echo ""
echo "🌊 AquaGuard — GitHub Setup"
echo "=============================="
echo "User : $GITHUB_USER"
echo "Repo : $REPO_NAME"
echo ""

# Check gh CLI
if ! command -v gh &>/dev/null; then
  echo "⚠  GitHub CLI not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install gh
  else
    sudo apt-get install -y gh 2>/dev/null || \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    sudo apt update && sudo apt install gh -y
  fi
fi

# Auth check
if ! gh auth status &>/dev/null; then
  echo "🔑 Please authenticate with GitHub..."
  gh auth login
fi

# Init git if needed
if [ ! -d ".git" ]; then
  git init
  echo "✓ Git initialized"
fi

# Set up .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.env.local
logs/
*.log
.DS_Store
coverage/
.vite/
*.pem
*.key
EOF

# Create repo on GitHub
echo "📦 Creating GitHub repo: $GITHUB_USER/$REPO_NAME"
gh repo create "$GITHUB_USER/$REPO_NAME" \
  --public \
  --description "AquaGuard — AI-powered water quality monitoring platform" \
  --homepage "https://$GITHUB_USER.github.io/$REPO_NAME" \
  2>/dev/null || echo "  (repo may already exist, continuing...)"

# Add remote
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"

# Initial commit
git add -A
git commit -m "feat: initial AquaGuard platform

- React + Node.js full-stack water quality dashboard
- Real-time WebSocket sensor simulation (8 Indian rivers)
- AI/ML engine: contamination, anomaly, scarcity, WQI forecast
- PostgreSQL + JWT auth
- Docker + AWS ECS CI/CD" || echo "  (nothing new to commit)"

git branch -M main
git push -u origin main --force

echo ""
echo "✅ Pushed to https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "Next: Set these GitHub Secrets for CI/CD:"
echo "  AWS_ACCESS_KEY_ID"
echo "  AWS_SECRET_ACCESS_KEY"
echo "  AWS_ACCOUNT_ID"
echo "  JWT_SECRET"
echo "  DATABASE_URL"
