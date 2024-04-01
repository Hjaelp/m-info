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

const Terminal = require("./helpers/terminal.js");
const Tagger = require("./helpers/tagger.js");
const { getDirs } = require("./helpers/archive.js");

const terminal = new Terminal(config);
const tagger = new Tagger(config, terminal);

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
        dir = config.BASE_DIR;
    }
    else if (resp.updateMode === "manual") {
        dir = await terminal.showDirectoryPrompt(config.BASE_DIR, getDirs);
    }

    if (!dir) return;

    await tagger.updateBooks(dir, !!resp.manualMode);
}

start();