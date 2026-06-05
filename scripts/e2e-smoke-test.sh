#!/bin/bash
set -e

echo "Starting E2E Smoke Test..."
echo "Checking health status inside the docx-to-pdf-converter container..."

MAX_ATTEMPTS=5
ATTEMPT=1
SUCCESS=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS..."

  # Execute curl inside the running container
  if docker exec docx-to-pdf-converter curl -s -f http://localhost:3000/health > /dev/null; then
    echo "✓ Health check succeeded!"
    echo "Response payload:"
    docker exec docx-to-pdf-converter curl -s http://localhost:3000/health
    echo ""
    SUCCESS=1
    break
  else
    echo "Container health check failed or not ready. Retrying in 2 seconds..."
    sleep 2
  fi
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $SUCCESS -ne 1 ]; then
  echo "✗ E2E Smoke Test failed: Container health endpoint not responding."
  exit 1
fi

echo "✓ E2E Smoke Test completed successfully!"
exit 0
