#!/bin/bash

# Link Finder - One Line Installation Script
# This script automatically installs and sets up the Link Finder application

set -e  # Exit on error (but we'll handle some errors manually)

echo "🚀 Link Finder - Installation Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

# Function to install Node.js on macOS
install_node_macos() {
    echo -e "${BLUE}📥 Installing Node.js 18+ on macOS...${NC}"
    
    # Try Homebrew first
    if command -v brew &> /dev/null; then
        echo -e "${BLUE}Using Homebrew to install Node.js...${NC}"
        brew install node@18 || brew install node
        # Add to PATH if needed
        if [ -f "/opt/homebrew/bin/node" ]; then
            export PATH="/opt/homebrew/bin:$PATH"
        elif [ -f "/usr/local/bin/node" ]; then
            export PATH="/usr/local/bin:$PATH"
        fi
        return 0
    fi
    
    # Try nvm if available
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${BLUE}Using nvm to install Node.js...${NC}"
        source "$HOME/.nvm/nvm.sh"
        nvm install 18
        nvm use 18
        return 0
    fi
    
    # Fallback: Install Homebrew and then Node.js
    echo -e "${YELLOW}Homebrew not found. Installing Homebrew first...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    if command -v brew &> /dev/null; then
        brew install node@18 || brew install node
        # Add to PATH
        if [ -f "/opt/homebrew/bin/node" ]; then
            export PATH="/opt/homebrew/bin:$PATH"
        elif [ -f "/usr/local/bin/node" ]; then
            export PATH="/usr/local/bin:$PATH"
        fi
        return 0
    fi
    
    return 1
}

# Function to install Node.js on Linux
install_node_linux() {
    echo -e "${BLUE}📥 Installing Node.js 18+ on Linux...${NC}"
    
    # Detect Linux distribution
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
    else
        DISTRO="unknown"
    fi
    
    # Try nvm first (works on all Linux distros)
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo -e "${BLUE}Using nvm to install Node.js...${NC}"
        source "$HOME/.nvm/nvm.sh"
        nvm install 18
        nvm use 18
        return 0
    fi
    
    # Install nvm if not present
    echo -e "${BLUE}Installing nvm (Node Version Manager)...${NC}"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    
    nvm install 18
    nvm use 18
    nvm alias default 18
    
    return 0
}

# Check and install Node.js
OS=$(detect_os)
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
    
    if [ "$OS" = "macos" ]; then
        set +e  # Temporarily disable exit on error
        install_node_macos
        INSTALL_RESULT=$?
        set -e  # Re-enable exit on error
        
        if [ $INSTALL_RESULT -eq 0 ]; then
            # Reload shell to get new PATH
            if command -v node &> /dev/null; then
                NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
                if [ "$NODE_VERSION" -ge 18 ]; then
                    echo -e "${GREEN}✓ Node.js installed successfully: $(node -v)${NC}"
                    NODE_VERSION_OK=true
                fi
            fi
        fi
    elif [ "$OS" = "linux" ]; then
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
    else
        echo -e "${RED}❌ Unsupported operating system: $OS${NC}"
        echo "Please install Node.js 18+ manually from https://nodejs.org/"
    fi
    
    # Final check
    if [ "$NODE_VERSION_OK" = false ]; then
        echo ""
        echo -e "${RED}❌ Could not automatically install Node.js 18+${NC}"
        echo "Please install Node.js 18+ manually:"
        echo "  - macOS: brew install node@18"
        echo "  - Linux: Use nvm (https://github.com/nvm-sh/nvm)"
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

