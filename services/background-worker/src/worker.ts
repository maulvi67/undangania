import { startMediaLoop } from "./media-runner";
import { startOutboxLoop } from "./outbox-runner";

/**
 * Long-lived entrypoint: runs every background loop in one process.
 *
 * The individual `outbox.ts` and `media.ts` entrypoints stay available for cron
 * (`--once`) runs. This one is what `npm run dev` and `npm start` use so a local
 * or deployed worker drains both the payment outbox and the media pipeline; each
 * loop is independent and logs its own failures, so one being unavailable does
 * not stop the other.
 */
const controller = new AbortController();
const shutdown = (): void => {
  controller.abort();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const signal = controller.signal;

void Promise.all([
  startOutboxLoop({ signal }),
  startMediaLoop({ signal }),
]).catch((error: unknown) => {
  console.error(
    "worker.failed",
    error instanceof Error ? error.message : "unknown-error",
  );
  process.exitCode = 1;
});
