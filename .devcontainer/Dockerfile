FROM node:18

# Update packages and install basic tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends git curl

# Create app directory
WORKDIR /workspace

# Set user to use when running container
USER node

# The node image includes a non-root user with sudo access