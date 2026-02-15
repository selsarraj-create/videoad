#!/bin/bash

# Start the Sharp Stitcher in the background
echo "Starting Sharp Stitcher on port ${STITCHER_PORT:-8081}..."
cd workers && STITCHER_PORT=${STITCHER_PORT:-8081} npm start &

# Start the Python Worker
echo "Starting Python Worker on port ${PORT:-8000}..."
cd .. && python -m uvicorn workers.main:app --host 0.0.0.0 --port ${PORT:-8000}
