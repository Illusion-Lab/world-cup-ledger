const endpoint = process.env.SYNC_ENDPOINT || "http://api:4000/internal/sync/scores";
const intervalSeconds = Math.max(Number(process.env.SCORE_SYNC_INTERVAL_SECONDS || 300), 30);
const retrySeconds = Math.max(Number(process.env.SCORE_SYNC_RETRY_SECONDS || 15), 5);
const secret = process.env.SYNC_SECRET;

if (!secret) {
  console.error("SYNC_SECRET is required for the score sync worker");
  process.exit(1);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncOnce() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-sync-secret": secret,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Sync failed with ${response.status}: ${text}`);
  }

  console.log(`[${new Date().toISOString()}] ${text}`);
}

while (true) {
  let nextDelaySeconds = intervalSeconds;
  try {
    await syncOnce();
  } catch (error) {
    console.error(`[${new Date().toISOString()}]`, error);
    nextDelaySeconds = retrySeconds;
  }
  await sleep(nextDelaySeconds * 1000);
}
