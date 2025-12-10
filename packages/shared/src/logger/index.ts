import pino from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

const isDevelopment = process.env.NODE_ENV === "development";
const logLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

export const createLogger = (context: string) => {
  return logger.child({ context });
};

export type Logger = typeof logger;
