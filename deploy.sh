#!/bin/bash
# ZKDrop - Deploy Contract Script
# Usage: ./deploy.sh <PRIVATE_KEY>
#
# IMPORTANT: Never commit your private key to version control!
# Store it securely and use environment variables in production.

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       ZKDrop Contract Deployment                   ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"

# Check for private key argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./deploy.sh <PRIVATE_KEY>${NC}"
    echo -e "${YELLOW}Example: ./deploy.sh APrivateKey1...${NC}"
    echo ""
    echo -e "${RED}ERROR: Private key is required!${NC}"
    echo ""
    echo -e "You can also set PRIVATE_KEY environment variable:"
    echo -e "  export PRIVATE_KEY=APrivateKey1..."
    echo -e "  ./deploy.sh"
    exit 1
fi

PRIVATE_KEY="$1"

# Configuration
NETWORK="testnet"
ENDPOINT="https://api.explorer.provable.com/v1"
PROGRAM_NAME="zkdrop_v4_0002.aleo"
CONTRACT_DIR="contracts/zkdrop_v2"

echo -e "${GREEN}Configuration:${NC}"
echo "  Network: $NETWORK"
echo "  Endpoint: $ENDPOINT"
echo "  Program: $PROGRAM_NAME"
echo "  Contract Dir: $CONTRACT_DIR"
echo ""

# Check if contract directory exists
if [ ! -d "$CONTRACT_DIR" ]; then
    echo -e "${RED}ERROR: Contract directory not found: $CONTRACT_DIR${NC}"
    exit 1
fi

# Navigate to contract directory
cd "$CONTRACT_DIR"

echo -e "${GREEN}Step 1: Building contract...${NC}"
leo build

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Contract build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Step 2: Deploying to Aleo $NETWORK...${NC}"
echo -e "${YELLOW}This may take a few minutes. Please wait...${NC}"
echo ""

# Deploy the contract (Leo 4.0.0 syntax)
leo deploy \
    --private-key "$PRIVATE_KEY" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast \
    --yes

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Deployment Successful!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Copy the Program ID from the output above"
    echo "  2. Update .env.local with the Program ID:"
    echo "     NEXT_PUBLIC_ZKDROP_PROGRAM_ID=<your-program-id>"
    echo "  3. Run 'npm run dev' to start the frontend"
    echo ""
    echo -e "${YELLOW}Verify on Aleo Explorer:${NC}"
    echo "  https://explorer.provable.com/program/$PROGRAM_NAME"
    echo ""
else
    echo -e "${RED}ERROR: Deployment failed!${NC}"
    echo -e "${YELLOW}Common issues:${NC}"
    echo "  - Insufficient balance (need ~100+ credits)"
    echo "  - Invalid private key"
    echo "  - Network connectivity issues"
    echo ""
    echo -e "Get testnet credits from: https://faucet.aleo.org"
    exit 1
fi
