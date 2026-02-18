#!/bin/bash
# PawPrint Universal Reporter Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/web/public/install.sh | bash -s YOUR_API_KEY
#
# Options:
#   --system-only    System metrics only (no OpenClaw)
#   --openclaw      Include OpenClaw metrics (default)
#   --full          Full monitoring suite with endpoints/processes

set -e

API_KEY=""
API_URL="https://web-xi-khaki.vercel.app/api"
MODE="openclaw"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --system-only)
      MODE="system"
      shift
      ;;
    --openclaw)
      MODE="openclaw"
      shift
      ;;
    --full)
      MODE="full"
      shift
      ;;
    -*)
      echo "Unknown option: $1"
      exit 1
      ;;
    *)
      if [[ -z "$API_KEY" ]]; then
        API_KEY="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$API_KEY" ]; then
    echo "Usage: curl -fsSL https://raw.githubusercontent.com/lowvisiondave/pawprint/main/packages/web/public/install.sh | bash -s YOUR_API_KEY"
    echo ""
    echo "Options:"
    echo "  --system-only   System metrics only"
    echo "  --openclaw      Include OpenClaw metrics (default)"  
    echo "  --full         Full monitoring with endpoints/processes"
    exit 1
fi

INSTALL_DIR="$HOME/.pawprint"
mkdir -p "$INSTALL_DIR"

echo "Installing PawPrint Universal Reporter..."
echo "Mode: $MODE"
echo "API URL: $API_URL"

# Create reporter script
cat > "$INSTALL_DIR/reporter.sh" << 'SCRIPT'
#!/bin/bash
set -e

API_KEY="REPLACE_API_KEY"
API_URL="REPLACE_API_URL"

# Get system stats
get_system_stats() {
    local hostname=$(hostname)
    local platform=$(uname -s)
    local arch=$(uname -m)
    
    # CPU
    local cpu_usage=0
    if [ "$platform" = "Linux" ]; then
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}' || echo "0")
    elif [ "$platform" = "Darwin" ]; then
        cpu_usage=$(top -l1 | grep "CPU usage" | awk '{print $3}' | tr -d '%' || echo "0")
    fi
    
    # Memory
    local mem_total=0
    local mem_free=0
    if [ "$platform" = "Linux" ]; then
        mem_total=$(free -m | awk '/^Mem:/{print $2}')
        mem_free=$(free -m | awk '/^Mem:/{print $7}')
    elif [ "$platform" = "Darwin" ]; then
        mem_total=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024)}')
        mem_free=$(vm_stat | awk '/Pages free/{print $3}' | tr -d '.')
        mem_free=$((mem_free * 4 / 1024))
    fi
    
    local mem_used=$((mem_total - mem_free))
    local mem_pct=$((mem_used * 100 / mem_total))
    
    # Disk
    local disk_total=$(df -BG / 2>/dev/null | awk 'NR==2 {print $2}' | tr -d 'G' || echo "0")
    local disk_free=$(df -BG / 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G' || echo "0")
    local disk_used=$((disk_total - disk_free))
    local disk_pct=$((disk_used * 100 / disk_total))
    
    # Uptime
    local uptime_seconds=$(cat /proc/uptime 2>/dev/null | awk '{print int($1)}' || sysctl -n kern.boottime | awk '{print int($(NF-1))}' || echo "0")
    
    # Local IP
    local local_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[^ ]+' || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
    
    echo "{\"hostname\":\"$hostname\",\"platform\":\"$platform\",\"arch\":\"$arch\",\"cpuUsagePercent\":$cpu_usage,\"memoryTotalMb\":$mem_total,\"memoryFreeMb\":$mem_free,\"memoryUsedPercent\":$mem_pct,\"diskTotalGb\":$disk_total,\"diskFreeGb\":$disk_free,\"diskUsedPercent\":$disk_pct,\"uptime\":$uptime_seconds,\"localIp\":\"$local_ip\"}"
}

# Get OpenClaw stats (if available)
get_openclaw_stats() {
    local oc_dir="$HOME/.openclaw"
    if [ ! -d "$oc_dir" ]; then
        echo "{\"active\":0,\"total\":0,\"enabled\":0,\"totalCrons\":0,\"uptime\":0}"
        return
    fi
    
    local sessions_file="$oc_dir/agents/main/sessions/sessions.json"
    local active=0
    local total=0
    
    if [ -f "$sessions_file" ]; then
        # Simple count - not perfect but works
        total=$(grep -c '"id"' "$sessions_file" 2>/dev/null || echo "0")
        active=$total  # Simplified
    fi
    
    local cron_file="$oc_dir/config/cron.json"
    local enabled=0
    local total_crons=0
    
    if [ -f "$cron_file" ]; then
        total_crons=$(grep -c '"name"' "$cron_file" 2>/dev/null || echo "0")
        enabled=$total_crons
    fi
    
    echo "{\"active\":$active,\"total\":$total,\"enabled\":$enabled,\"totalCrons\":$total_crons,\"uptime\":0}"
}

# Main payload
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SYSTEM_STATS=$(get_system_stats)
OC_STATS=$(get_openclaw_stats)

# Parse OpenClaw stats
ACTIVE=$(echo "$OC_STATS" | grep -oP '"active":\K\d+' || echo "0")
TOTAL=$(echo "$OC_STATS" | grep -oP '"total":\K\d+' || echo "0")
ENABLED=$(echo "$OC_STATS" | grep -oP '"enabled":\K\d+' || echo "0")
TOTAL_CRONS=$(echo "$OC_STATS" | grep -oP '"totalCrons":\K\d+' || echo "0")

PAYLOAD="{\"timestamp\":\"$TIMESTAMP\",\"gateway\":{\"online\":true,\"uptime\":0},\"sessions\":{\"active\":$ACTIVE,\"total\":$TOTAL},\"crons\":{\"enabled\":$ENABLED,\"total\":$TOTAL_CRONS},\"costs\":{\"today\":0,\"month\":0},\"system\":$SYSTEM_STATS}"

# Post to API
curl -s -X POST "$API_URL/v1/report" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "$PAYLOAD" > /dev/null 2>&1

echo "Reported at $TIMESTAMP"
SCRIPT

# Replace placeholders
sed -i "s|REPLACE_API_KEY|$API_KEY|g" "$INSTALL_DIR/reporter.sh"
sed -i "s|REPLACE_API_URL|$API_URL|g" "$INSTALL_DIR/reporter.sh"
chmod +x "$INSTALL_DIR/reporter.sh"

# Add to crontab
CRON_LINE="*/5 * * * * $INSTALL_DIR/reporter.sh"
if ! (crontab -l 2>/dev/null || true) | grep -q "pawprint/reporter.sh"; then
    (crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
    echo "Added to crontab: */5 * * * *"
else
    echo "Already in crontab"
fi

echo ""
echo "✅ PawPrint Universal Reporter installed!"
echo ""
echo "Location: $INSTALL_DIR/reporter.sh"
echo "Config:   $INSTALL_DIR/config.json"
echo ""
echo "Test it now:"
echo "  $INSTALL_DIR/reporter.sh"
echo ""
echo "View logs:"
echo "  grep pawprint /var/log/syslog"
echo "  crontab -l | grep pawprint"
echo ""
echo "For full monitoring (endpoints, processes), create config:"
echo "  cp ~/.pawprint/config.example.json ~/.pawprint/config.json"
echo "  # Edit config.json with your endpoints and processes"
