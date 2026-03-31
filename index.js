const config = (function () {
    try {
        return require("./config.js");
    }
    catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            throw new Error("config.js file is not found. Please rename and edit `example.config.js` to `config.js` then try again.");
        }
        else throw e;
    }
})();

const fs = require("fs");

if (!config.INPUT_DIR || !fs.existsSync(config.INPUT_DIR)) {
    throw new Error(`INPUT_DIR "${config.INPUT_DIR}" does not exist. Please check your config.js file.`);
}
if (config.USE_OUTPUT_DIR) {
    if (!config.OUTPUT_DIR) {
        throw new Error("USE_OUTPUT_DIR is true but OUTPUT_DIR is not set. Please check your config.js file.");
    }
    if (!fs.existsSync(config.OUTPUT_DIR)) {
        throw new Error(`OUTPUT_DIR "${config.OUTPUT_DIR}" does not exist. Please check your config.js file.`);
    }
}

const Terminal = require("./helpers/terminal.js");
const Tagger = require("./helpers/tagger.js");
const { getDirs } = require("./helpers/archive.js");

const terminal = new Terminal(config);
const tagger = new Tagger(config, terminal);

const logger = require("./helpers/logger.js");
logger.setTerminal(terminal);
logger.setLogLevel(config.LOG_LEVEL);

async function start() {
    while (true) {
        await mainMenu();
    }
}

async function mainMenu() {
    let resp = await terminal.showMainMenuPrompt();
    let dir = null;

    if (!resp) return;

    if (resp.updateMode === "all") {
        dir = config.INPUT_DIR;
    }
    else if (resp.updateMode === "manual") {
        dir = await terminal.showDirectoryPrompt(config.INPUT_DIR, getDirs);
    }

    if (!dir) return;

    await tagger.updateBooks(dir, !!resp.manualMode);
}

start();