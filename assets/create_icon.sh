#!/bin/bash
# Create simple colored PNG icons for the app

# Icon (256x256)
convert -size 256x256 xc:none \
  -fill "#4f46e5" -draw "circle 128,128 128,20" \
  -fill white -pointsize 120 -gravity center -annotate +0+0 "⏱" \
  icon.png 2>/dev/null || echo "ImageMagick not available, creating placeholder"

# Tray icon (32x32)
convert -size 32x32 xc:none \
  -fill "#4f46e5" -draw "circle 16,16 16,4" \
  -fill white -pointsize 20 -gravity center -annotate +0+0 "⏱" \
  tray-icon.png 2>/dev/null || echo "ImageMagick not available, creating placeholder"

# If ImageMagick is not available, create simple placeholder files
if [ ! -f icon.png ]; then
  # Create a simple placeholder using echo
  echo "Placeholder icon" > icon.png
fi

if [ ! -f tray-icon.png ]; then
  echo "Placeholder tray icon" > tray-icon.png
fi
