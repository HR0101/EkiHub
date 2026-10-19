# syntax=docker/dockerfile:1
# check=error=true

# Make sure NODE_VERSION matches the Node version in package.json (engines) and the production VM
ARG NODE_VERSION=20.20.2
FROM docker.io/library/node:$NODE_VERSION-slim AS base

# EkiHub app lives here
WORKDIR /usr/src/ekihub

# Install base packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        git && \
    rm -rf /var/lib/apt/lists/*

# Set development environment
ENV NODE_ENV="development" \
    NEXT_TELEMETRY_DISABLED="1"

# Install application packages
COPY package.json package-lock.json ./
RUN npm ci

# Copy application code
COPY . .

# Entrypoint syncs the packages.
ENTRYPOINT ["./bin/docker-entrypoint"]

# Start the Next.js dev server by default, this can be overwritten at runtime
EXPOSE 3000
