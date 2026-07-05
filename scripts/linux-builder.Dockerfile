# Build environment for the gnarvox Studio Linux packages (.deb by default,
# AppImage optional via BUNDLES=appimage,deb).
#
# We build on Ubuntu 24.04 so the produced binaries link against an older
# glibc/WebKitGTK and stay portable to 24.04+ (including 26.04).
#
#   docker build -t gnarvox-linux-builder -f scripts/linux-builder.Dockerfile scripts
#   docker run --rm -v "$PWD:/work" -w /work gnarvox-linux-builder \
#     bash scripts/build-linux.sh

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    wget \
    file \
    pkg-config \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libgtk-3-dev \
    patchelf \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Node 22 (Ubuntu 24.04's apt nodejs is too old for Vite 6)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Rust toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"
