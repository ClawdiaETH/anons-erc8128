#!/bin/bash
# Submit governance proposal onchain to Anons DAO Governor
# Uses Foundry's cast with proper syntax
set -e

GOVERNOR="0xc44e1FaF399F64a9Af523076b8dA917427b5bD0B"
RPC_URL="https://mainnet.base.org"

TARGET="0x167b2f7Ce609Bf0117A148e6460A4Ca943f6dF32"
DESCRIPTION="Test Proposal: Verify Governance System. This is a test proposal with one harmless action (0 ETH transfer to Timelock). Submitted by Clawdia (Agent ID 23606)."

echo "🔐 Loading signing key from keychain..."
KEY=$(~/clawd/scripts/get-secret.sh signing_key)
FROM=$(cast wallet address --private-key "$KEY")

echo "📝 Submitting proposal from $FROM..."
echo "Governor: $GOVERNOR"
echo ""

# Create a temporary file for the calldata array since cast doesn't handle complex nested arrays well via CLI
cat > /tmp/propose-calldata.txt << 'EOF'
0x
EOF

# Submit using cast call-raw with properly formatted arguments
# The trick: pass each array element explicitly
cast send "$GOVERNOR" \
  "propose(address[],uint256[],string[],bytes[],string)" \
  "[$TARGET]" \
  "[0]" \
  "[]" \
  "[0x]" \
  "$DESCRIPTION" \
  --private-key "$KEY" \
  --rpc-url "$RPC_URL"

echo ""
echo "✅ Proposal submitted!"
