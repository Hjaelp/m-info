class TerminalLogger {
    constructor(config) {
        this.terminal = null;
        this.logLevel = 1;
    }

    verbose(message) {
        return this.logLevel <= 0 && this.terminal?.appendTextBox(`^G[VERBOSE]^ ${message}`) || false;
    }

    info(message) {
        return this.logLevel <= 1 && this.terminal?.appendTextBox(`^G[INFO]^ ${message}`) || false;
    }

    warn(message) {
        return this.logLevel <= 2 && this.terminal?.appendTextBox(`^Y[WARN]^ ${message}`) || false;
    }

    error(message) {
        return this.logLevel <= 3 && this.terminal?.appendTextBox(`^R[ERR]^ ${message}`) || false;
    }

    log(message) {
        return this.terminal?.appendTextBox(message) && true || false;
    }

    setTerminal(terminal) {
        if (terminal && terminal.appendTextBox) {
            this.terminal = terminal;
        }
    }

    setLogLevel(logLevel) {
        if (typeof logLevel === "string") {
            logLevel = parseInt(logLevel);
        }
        if (!logLevel || logLevel < 0) {
            logLevel = 0;
        }
        else if (logLevel > 3) {
            logLevel = 3;
        }

        this.logLevel = logLevel;
    }
}

const logger = new TerminalLogger();

module.exports = logger;