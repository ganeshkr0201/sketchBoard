#!/bin/bash

# Cleanup script for files that should be ignored by git
# This script removes files that are now in .gitignore

echo "🧹 Cleaning up files that should be ignored..."
echo ""

# Remove .DS_Store files
echo "Removing .DS_Store files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null
echo "✅ .DS_Store files removed"

# Remove debug/temp files
echo ""
echo "Removing debug and temporary files..."
rm -f question.txt functionality.text 2>/dev/null
echo "✅ Debug files removed"

# Remove uploaded files (keep directory structure)
echo ""
echo "Cleaning uploads directory..."
if [ -d "backend/uploads" ]; then
  find backend/uploads -type f \( -name "*.pdf" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -delete 2>/dev/null
  echo "✅ Uploaded files removed (directory kept)"
fi

# Remove log files
echo ""
echo "Removing log files..."
find . -name "*.log" -type f -delete 2>/dev/null
echo "✅ Log files removed"

# Remove IDE files
echo ""
echo "Removing IDE configuration..."
rm -rf .vscode 2>/dev/null
echo "✅ IDE files removed"

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "📝 Note: The following are now ignored by git:"
echo "  - node_modules/"
echo "  - .env files"
echo "  - dist/ and build/ directories"
echo "  - uploads/ directory"
echo "  - .DS_Store files"
echo "  - IDE configuration files"
echo "  - Log files"
echo "  - Temporary files"
echo ""
echo "💡 Run 'git status' to see what's tracked"
