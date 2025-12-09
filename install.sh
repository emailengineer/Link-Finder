#!/bin/bash

# Link Finder - One Line Installation Script (Linux)
# This script automatically installs and sets up the Link Finder application on Linux

set -e  # Exit on error (but we'll handle some errors manually)

echo "🚀 Link Finder - Installation Script (Linux)"
echo "============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}❌ This script is designed for Linux only${NC}"
    exit 1
fi

# Function to install Node.js on Linux using nvm
install_node_linux() {
    echo -e "${BLUE}📥 Installing Node.js 18+ on Linux...${NC}"
    
    # Try nvm first (works on all Linux distros)
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${BLUE}Using existing nvm installation...${NC}"
        source "$HOME/.nvm/nvm.sh"
        nvm install 18
        nvm use 18
        nvm alias default 18
        return 0
    fi
    
    # Install nvm if not present
    echo -e "${BLUE}Installing nvm (Node Version Manager)...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    
    # Load nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    # Install Node.js 18
    nvm install 18
    nvm use 18
    nvm alias default 18
    
    # Add nvm to shell profile for persistence
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "NVM_DIR" "$HOME/.bashrc"; then
            echo '' >> "$HOME/.bashrc"
            echo '# NVM Configuration' >> "$HOME/.bashrc"
            echo 'export NVM_DIR="$HOME/.nvm"' >> "$HOME/.bashrc"
            echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> "$HOME/.bashrc"
            echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> "$HOME/.bashrc"
        fi
    fi
    
    return 0
}

# Check and install Node.js
NODE_INSTALLED=false
NODE_VERSION_OK=false

if command -v node &> /dev/null; then
    NODE_INSTALLED=true
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        NODE_VERSION_OK=true
        echo -e "${GREEN}✓ Node.js found: $(node -v)${NC}"
    else
        echo -e "${YELLOW}⚠️  Node.js version $(node -v) is too old. Need 18+${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Node.js is not installed${NC}"
fi

# Install Node.js if needed
if [ "$NODE_INSTALLED" = false ] || [ "$NODE_VERSION_OK" = false ]; then
    echo ""
    echo -e "${BLUE}Attempting to automatically install Node.js 18+...${NC}"
    
    set +e  # Temporarily disable exit on error
    install_node_linux
    INSTALL_RESULT=$?
    set -e  # Re-enable exit on error
    
    if [ $INSTALL_RESULT -eq 0 ]; then
        # Reload shell to get new PATH
        if [ -s "$HOME/.nvm/nvm.sh" ]; then
            source "$HOME/.nvm/nvm.sh"
        fi
        if command -v node &> /dev/null; then
            NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
            if [ "$NODE_VERSION" -ge 18 ]; then
                echo -e "${GREEN}✓ Node.js installed successfully: $(node -v)${NC}"
                NODE_VERSION_OK=true
            fi
        fi
    fi
    
    # Final check
    if [ "$NODE_VERSION_OK" = false ]; then
        echo ""
        echo -e "${RED}❌ Could not automatically install Node.js 18+${NC}"
        echo "Please install Node.js 18+ manually:"
        echo "  - Install nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "  - Then: nvm install 18 && nvm use 18"
        echo "  - Or download from: https://nodejs.org/"
        echo ""
        echo "After installing, please run this script again."
        exit 1
    fi
fi

# Verify npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not available${NC}"
    echo "Please restart your terminal and run this script again."
    exit 1
fi

echo -e "${GREEN}✓ npm found: $(npm -v)${NC}"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To start the server, run:"
echo -e "${YELLOW}  npm start${NC}"
echo ""
echo "Or use Docker:"
echo -e "${YELLOW}  docker-compose up${NC}"
echo ""
echo "The API will be available at: http://localhost:3000"
echo ""
echo -e "${BLUE}💡 Tip: If Node.js was just installed, you may need to${NC}"
echo -e "${BLUE}   restart your terminal or run: source ~/.bashrc${NC}"
echo ""
