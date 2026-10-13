import { drainMediaOnce, startMediaLoop } from "./media-runner";

/**
 * Entrypoint for the media-processing runner.
 *
 * `--once` drains a single batch and exits, which is the shape a cron or a
 * one-off operator run wants. Without it, the process polls until it receives
 * `SIGINT`/`SIGTERM`, which is the shape a long-lived worker wants.
 */
const runOnce = process.argv.includes("--once");

if (runOnce) {
  drainMediaOnce()
    .then((summary) => {
      console.info("media.drained", summary);
    })
    .catch((error: unknown) => {
      console.error(
        "media.drain.failed",
        error instanceof Error ? error.message : "unknown-error",
      );
      process.exitCode = 1;
    });
} else {
  const controller = new AbortController();
  const shutdown = (): void => {
    controller.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  startMediaLoop({ signal: controller.signal }).catch((error: unknown) => {
    console.error(
      "media.runner.failed",
      error instanceof Error ? error.message : "unknown-error",
    );
    process.exitCode = 1;
  });
}
