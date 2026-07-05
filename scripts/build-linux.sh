#!/usr/bin/env bash
# Build the Linux package for gnarvox Studio. Default: .deb (recommended for
# Debian/Ubuntu). Pass BUNDLES=appimage,deb to also build an AppImage.
#
# Intended to run inside the gnarvox-linux-builder container (see
# linux-builder.Dockerfile) so the binaries link against Ubuntu 24.04's
# glibc/WebKitGTK and stay portable across 24.04+:
#
#   docker build -t gnarvox-linux-builder -f scripts/linux-builder.Dockerfile scripts
#   docker run --rm -v "$PWD:/work" -w /work \
#     -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
#     gnarvox-linux-builder bash scripts/build-linux.sh
#
# Artifacts land in src-tauri/target/release/bundle/deb/ (and appimage/).

set -euo pipefail

BUNDLES="${BUNDLES:-deb}"

# linuxdeploy & friends are AppImages themselves; containers have no FUSE.
export APPIMAGE_EXTRACT_AND_RUN=1
# Some bundled libs trip `strip` on newer distros; not worth failing over.
export NO_STRIP=${NO_STRIP:-true}

npm ci
npm run tauri build -- --bundles "$BUNDLES"

echo
echo "=== artifacts ==="
find src-tauri/target/release/bundle -maxdepth 2 -type f \
  \( -name '*.AppImage' -o -name '*.deb' \) -exec ls -lh {} \;

# Hand ownership back to the host user when run as root in a container.
if [[ -n "${HOST_UID:-}" && -n "${HOST_GID:-}" ]]; then
  chown -R "$HOST_UID:$HOST_GID" src-tauri/target node_modules dist 2>/dev/null || true
fi
