import { FifoLogger, FifoLoggerConfig, LogDestination, LogLevel } from "../src/fifoLogger";

console.log("TEST START");

const flc: FifoLoggerConfig = {
  minLogLevel: LogLevel.DEBUG,
  maxEventLength: 1024,
  destination: LogDestination.STDOUT,
  useColor: true,
  jsonMode: false,
  //fileName: "/tmp/test.log"
}
FifoLogger.init(flc)
let i=0

const testStr = " TEST ME UP 1 2 3"
const testAttachedObj1 = {alfa:"beta", apple: 123}
const testAttachedObj2 = ["gamma", "delta", "epsilon"]

const intvl = setInterval(() => {
    if (i<1000) {
        const lvl = Math.floor(Math.random() * 4)
        FifoLogger.log(lvl, i + testStr, testAttachedObj1, testAttachedObj2)
        i++
    } else {
        clearInterval(intvl)
        console.log("ALL ENQUEUE DONE")
        FifoLogger.close( onFifoLoggerClosed )
    }
}, 1)

function onFifoLoggerClosed() {
    console.log("Exit 0");
    process.exit(0)
}
