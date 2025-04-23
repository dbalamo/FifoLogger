import { FifoLogger, LogLevel } from "../src/fifoLogger";

console.log("TEST START");

const testAttachedObj1 = {alfa:"beta", apple: 123}
const testAttachedObj2 = ["gamma", "delta", "epsilon"]

FifoLogger.log(LogLevel.DEBUG, "1 - TEST ME UP 1 2 3", testAttachedObj1, testAttachedObj2)
FifoLogger.log(LogLevel.WARNING, "2 - Simple Message without attachments")

console.log("ENDE");
