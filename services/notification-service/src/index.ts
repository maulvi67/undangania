import type { NotificationPort } from "@wedding/notifications";
export class NotificationDispatcher { constructor(private readonly port: NotificationPort) {} async deliver(message: Parameters<NotificationPort["send"]>[0]) { return this.port.send(message); } }
