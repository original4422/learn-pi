FROM node:24.19.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/learn-pi
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts && rm -rf .cache/npm
COPY src ./src
COPY scripts ./scripts
COPY examples/fixtures ./examples/fixtures
COPY examples/mcp-server.ts ./examples/mcp-server.ts
USER node
ENTRYPOINT ["node", "--import", "tsx"]
CMD ["src/cli.ts", "--workspace", "/workspace"]
