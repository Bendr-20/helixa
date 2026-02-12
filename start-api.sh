#!/bin/bash
# Start Helixa API + Cloudflare Tunnel
cd /home/ubuntu/.openclaw/workspace/agentdna

# Start API server
node api/server.js &
API_PID=$!
echo "API started (PID $API_PID)"
sleep 3

# Verify API is responding
if curl -s http://localhost:3456/api/stats > /dev/null 2>&1; then
    echo "API responding on :3456"
else
    echo "API failed to start"
    cat /tmp/helixa-api.log
    exit 1
fi

# Start Cloudflare tunnel
cloudflared tunnel --url http://localhost:3456 2>&1 &
TUNNEL_PID=$!
echo "Tunnel started (PID $TUNNEL_PID)"
sleep 5

echo "---tunnel started---"
echo "API PID: $API_PID"
echo "Tunnel PID: $TUNNEL_PID"

# Keep running
wait
