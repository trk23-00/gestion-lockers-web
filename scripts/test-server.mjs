process.env.NODE_ENV = "development";
process.env.__NEXT_DEV_SERVER = "1";
const { startServer } = await import("next/dist/server/lib/start-server.js");
process.on("message", (message) => {
  if (message === "shutdown") process.emit("SIGTERM", "SIGTERM");
});
await startServer({
  dir: process.cwd(),
  port: 3117,
  hostname: "127.0.0.1",
  isDev: true,
  allowRetry: false,
});
process.send?.("ready");
