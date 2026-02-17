#!/bin/bash
# 🐾 pawprint reporter installer
# 
# Usage: curl -fsSL https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/reporter/install.sh | bash -s YOUR_API_KEY
#
# Or with custom URL:
# curl -fsSL ... | bash -s YOUR_API_KEY https://your-pawprint-instance.com/api

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🐾 pawprint reporter installer${NC}"
echo ""

# Check arguments
API_KEY="${1:-}"
API_URL="${2:-https://web-xi-khaki.vercel.app/api}"

if [ -z "$API_KEY" ]; then
  echo -e "${RED}Error: API key required${NC}"
  echo "Usage: $0 YOUR_API_KEY [API_URL]"
  echo ""
  echo "Get your API key from your pawprint dashboard settings."
  exit 1
fi

# Detect OpenClaw directory
OPENCLAW_DIR=""
if [ -d "$HOME/.openclaw" ]; then
  OPENCLAW_DIR="$HOME/.openclaw"
elif [ -d "/home/$(whoami)/.openclaw" ]; then
  OPENCLAW_DIR="/home/$(whoami)/.openclaw"
else
  echo -e "${RED}Error: OpenClaw directory not found${NC}"
  echo "Make sure OpenClaw is installed and running."
  exit 1
fi

echo -e "Found OpenClaw at: ${GREEN}$OPENCLAW_DIR${NC}"

# Create pawprint directory
PAWPRINT_DIR="$OPENCLAW_DIR/pawprint"
mkdir -p "$PAWPRINT_DIR"

# Download reporter
echo "Downloading reporter..."
curl -fsSL "https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/reporter/reporter.ts" -o "$PAWPRINT_DIR/reporter.ts"

# Create config file
echo "Creating config..."
cat > "$PAWPRINT_DIR/config.env" << EOF
PAWPRINT_API_KEY=$API_KEY
PAWPRINT_API_URL=$API_URL
EOF

# Create runner script
cat > "$PAWPRINT_DIR/run.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source ./config.env
export PAWPRINT_API_KEY PAWPRINT_API_URL
npx tsx reporter.ts
EOF
chmod +x "$PAWPRINT_DIR/run.sh"

# Test the reporter
echo ""
echo "Testing reporter..."
cd "$PAWPRINT_DIR"
source ./config.env
export PAWPRINT_API_KEY PAWPRINT_API_URL

if npx tsx reporter.ts; then
  echo ""
  echo -e "${GREEN}✅ Reporter installed successfully!${NC}"
  echo ""
  echo "Location: $PAWPRINT_DIR"
  echo ""
  echo "To run manually:"
  echo "  $PAWPRINT_DIR/run.sh"
  echo ""
  echo "To set up as a cron job (every 5 minutes):"
  echo "  (crontab -l 2>/dev/null; echo '*/5 * * * * $PAWPRINT_DIR/run.sh >> $PAWPRINT_DIR/reporter.log 2>&1') | crontab -"
  echo ""
  echo "Or add to your OpenClaw agent's HEARTBEAT.md to check during heartbeats."
else
  echo ""
  echo -e "${RED}❌ Reporter test failed${NC}"
  echo "Check your API key and try again."
  exit 1
fi
