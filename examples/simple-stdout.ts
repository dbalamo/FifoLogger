import { FifoLogger, LogLevel } from "../src/fifoLogger";

console.log("Application Start");

const testAttachedObj1 = { userId: 123 }
const testAttachedObj2 = ["gamma", "delta", "epsilon"]

FifoLogger.log(LogLevel.WARNING, "Simple Message without attachments")

FifoLogger.info("Server started successfully.");
FifoLogger.debug("not visible, default log level is INFO");
FifoLogger.warn("Configuration value missing, using default.", testAttachedObj1);
FifoLogger.error("Failed to connect to database", new Error("Connection timeout"));

console.log("Application End");
