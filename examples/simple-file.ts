import { FifoLogger, FifoLoggerConfig, LogDestination, LogLevel } from '../src/fifoLogger'; // Adjust path/name as needed

console.log("Application Start");

// Configuration for logging to a file
const config: FifoLoggerConfig = {
  logPrefix: "YourAppName",
  minLogLevel: LogLevel.INFO,
  destination: LogDestination.FILE,
  fileName: "/tmp/yourappname.log", // Specify the log file path
  jsonMode: true // Log in JSON format
};

// Initialize the logger
FifoLogger.init(config);

// Log messages
FifoLogger.info("Processing started for file", { filename: "data.csv" });
// ... log more messages ...
FifoLogger.error("Error processing record", { recordId: 45, error: "Invalid format" });

// IMPORTANT: Close the logger to ensure all buffered logs are written to the file
console.log("Processing finished, closing logger...");
FifoLogger.close(() => {
  console.log("Logger closed. Exiting.");
  process.exit(0);
});