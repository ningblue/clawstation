#!/bin/bash
# X-Claw Setup Script
# This script sets up the required local dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "X-Claw Setup"
echo "================="

# Check if lib directory exists
if [ ! -d "$PROJECT_DIR/lib" ]; then
    mkdir -p "$PROJECT_DIR/lib"
fi

# Check for OpenClaw
if [ ! -d "$PROJECT_DIR/lib/openclaw" ]; then
    echo "Error: lib/openclaw not found!"
    echo ""
    echo "Please either:"
    echo "1. Copy your OpenClaw installation to lib/openclaw"
    echo "2. Or clone from: https://github.com/your-repo/openclaw"
    exit 1
fi

# Check for lobehub
if [ ! -d "$PROJECT_DIR/lib/lobehub" ]; then
    echo "Error: lib/lobehub not found!"
    echo ""
    echo "Please either:"
    echo "1. Copy lobehub to lib/lobehub"
    echo "2. Or install from npm"
    exit 1
fi

echo "Dependencies found!"
echo ""
echo "Installing npm dependencies..."
cd "$PROJECT_DIR"
npm install

echo ""
echo "Setup complete! Run 'npm run dev' to start development"
