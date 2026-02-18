#!/bin/bash
# PawPrint Reporter Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/web/public/install.sh | bash -s YOUR_API_KEY

set -e

API_KEY="${1:-}"
if [ -z "$API_KEY" ]; then
    echo "Usage: curl -fsSL https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/web/public/install.sh | bash -s YOUR_API_KEY"
    exit 1
fi

INSTALL_DIR="$HOME/.pawprint"
mkdir -p "$INSTALL_DIR"

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > "$INSTALL_DIR/reporter.sh" << ENDSCRIPT
#!/bin/bash
API_KEY="$API_KEY"
API_URL="https://web-xi-khaki.vercel.app/api"

curl -s -X POST "$API_URL/v1/report" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer \$API_KEY" \
    -d '{"timestamp": "$TIMESTAMP", "gateway": {"online": true, "uptime": 0}, "sessions": {"active": 0, "total": 0}, "crons": {"enabled": 0, "total": 0}, "costs": {"today": 0, "month": 0}}' > /dev/null 2>&1
ENDSCRIPT

chmod +x "$INSTALL_DIR/reporter.sh"

# Add to crontab if not already there
CRON_ENTRY="*/5 * * * * $INSTALL_DIR/reporter.sh"
if ! crontab -l 2>/dev/null | grep -q "pawprint/reporter.sh"; then
    (crontab -l 2>/dev/null || true; echo "$CRON_ENTRY") | crontab -
fi

echo "✅ PawPrint reporter installed!"
echo "   Script: $INSTALL_DIR/reporter.sh"
echo "   Cron: runs every 5 minutes"
echo ""
echo "To manually test: $INSTALL_DIR/reporter.sh"
