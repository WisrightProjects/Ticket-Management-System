#!/bin/sh
set -e

# Fix ownership of the uploads volume at runtime.
# The named volume may have been created with root ownership on a previous
# deployment (before the chown-before-VOLUME fix). Running chown here as root
# ensures the appuser can always write to the directory regardless of how the
# volume was originally initialised.
chown -R appuser:appgroup /app/server/uploads 2>/dev/null || true

# Drop privileges and hand off to the application startup script.
exec su -s /bin/sh appuser -c 'exec /app/start.sh'
