module.exports = {
  apps: [
    {
      name: "server",
      script: "./dist/index.js",
      env: { NODE_ENV: "development", PORT: 4000 },
    },
    {
      name: "worker-fetch-market",
      script: "./dist/scripts/fetch-market.js",
      env: { NODE_ENV: "development" },
    },
  ],
}
