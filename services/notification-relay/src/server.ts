import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import {
  createSmtpEmailSender,
  relayConfigFromEnv,
  type RelayConfig,
} from "./email-sender";
import { createRelayHandler } from "./handler";

/**
 * Relay entrypoint.
 *
 * Configuration is validated before the socket opens, so a deployment with no
 * API key or SMTP credentials fails its health check instead of accepting
 * messages it cannot deliver.
 */

export type RelayServer = Readonly<{
  server: Server;
  config: RelayConfig;
}>;

export function createRelayServer(config: RelayConfig): Server {
  const sender = createSmtpEmailSender(config.smtp);
  const handler = createRelayHandler({ apiKey: config.apiKey, sender });
  return createServer((request, response) => {
    void handler(request, response);
  });
}

export function startRelayServer(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RelayServer {
  const config = relayConfigFromEnv(env);
  const server = createRelayServer(config);
  server.listen(config.port, config.hostname, () => {
    console.info("relay.listening", { port: config.port });
  });
  return { server, config };
}

const entrypoint = process.argv[1];
if (
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href
) {
  try {
    const { server } = startRelayServer();
    const shutdown = (): void => {
      server.close(() => {
        process.exitCode = 0;
      });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "relay.start.failed",
      error instanceof Error ? error.message : "unknown-error",
    );
    process.exitCode = 1;
  }
}
