const Manga = require("./manga.js");
const archive = require("./archive.js");

const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

class Tagger {
    constructor(config, terminal) {
        this.config = config;
        this.terminal = terminal;
        this.metadataProvider = new Manga(config);

        this.progressBars = this.createAllProgressBars();
    }

    async updateBooks(dir, previewMode = false) {
        this.terminal.showUpdateScreen();

        this.terminal.appendTextBox("^G[Info]^ Searching for series in the base directory...");
        let AllSeriesDir = await archive.walkDirs(dir);

        let i = 0;
        let totalSeries = Object.keys(AllSeriesDir).length;
        for (let seriesDir of Object.values(AllSeriesDir)) {
            let seriesInfo = await this.getSeriesInfo(seriesDir, previewMode);
            if (!seriesInfo) {
                continue;
            }

            let chaptersInfo = await this.getChaptersInfo(seriesDir, seriesInfo);
            await this.saveSeriesMetadata(seriesDir, seriesInfo, chaptersInfo);

            let coversInfo = await this.getCovers(seriesDir, seriesInfo);
            await this.saveCovers(seriesDir, seriesInfo, coversInfo);

            this.terminal.appendTextBox(`\n^GDone updating ${seriesInfo["ComicInfo"].Series || seriesInfo.seriesName}!^\n`);

            i++;
            if (i < totalSeries) {
                this.terminal.appendTextBox("^GContinuing in 5 seconds...^\n^GPress ^BCTRL+R^ ^Gto return to Main Menu.^\n");
                let res = await Promise.race([sleep(5000), this.terminal.waitForReturn()]);
                if (res === "return") {
                    return;
                }
                this.progressBars["provider"].hide();
                this.progressBars["chapter"].hide();
                this.progressBars["cover"].hide();
            }

            if (this.terminal.restartOnFree) return false;
        }

        this.terminal.appendTextBox("\n^GAll tasks are completed! Press ^BCTRL+R^ ^Gto return to Main Menu.^\n");
        await this.terminal.waitForReturn();
    }

    async getSeriesInfo(seriesDir, previewMode) {
        this.terminal.appendTextBox(`^G[Info]^ Searching for ${seriesDir.seriesName}`);

        await sleep(1000);

        this.metadataProvider.setProviders();
        let seriesInfo = await this.metadataProvider.getInfo(seriesDir.seriesName, this.progressBars["provider"], previewMode);
        let manualModeProviders = [];

        if (previewMode) {
            manualModeProviders = await this.terminal.showManualProviderWindow(seriesInfo);
            if (!manualModeProviders) {
                return false;
            }
            else if (!manualModeProviders.length) {
                this.terminal.appendTextBox(`^Y[Warn]^ No metadata providers for ${seriesDir.seriesName} have been selected. Skipping series.`);
                return false;
            }
            else {
                this.progressBars["provider"].reset();
                this.metadataProvider.setProviders(manualModeProviders);
                seriesInfo = await this.metadataProvider.getInfo(seriesDir.seriesName, this.progressBars["provider"], false);
            }
        }

        if (!seriesInfo || !Object.keys(seriesInfo).length) {
            this.terminal.appendTextBox(`^Y[Warn]^ Could not find any results for ${seriesDir.seriesName}. Skipping`);
            return false;
        }

        this.terminal.appendTextBox(`^G[Info]^ Found Series ${seriesInfo["ComicInfo"].Series || seriesDir.seriesName}.`);

        this.progressBars["main"].progress();

        return seriesInfo;
    }

    async getChaptersInfo(seriesDir, seriesInfo) {
        this.terminal.appendTextBox(`^G[Info]^ Searching for ${seriesInfo["ComicInfo"].Series || seriesDir.seriesName} chapter metadata...`);
        let chaptersInfo = await this.metadataProvider.getChapters(seriesInfo.id, this.progressBars["chapter"]);

        if (!chaptersInfo) {
            this.terminal.appendTextBox(`^Y[Warn]^ Could not find any chapter results for ${seriesInfo["ComicInfo"].Series}. Skipping.`);
        }

        return chaptersInfo;
    }

    async saveSeriesMetadata(seriesDir, seriesInfo, chaptersInfo) {

        let saveTasks = [];
        if (this.config.CREATE_SERIES_JSON) {
            saveTasks.push("Saving series.json...");
        }

        if (!chaptersInfo) {
            this.progressBars["chapter"].setTasks([]);
        }
        else {
            this.terminal.appendTextBox(`^G[Info]^ Found ${Object.keys(chaptersInfo).length} chapters for ${seriesInfo["ComicInfo"].Series}.`);

            this.progressBars["main"].progress();

            Object.keys(chaptersInfo).map((ch) =>
                saveTasks.push(`Saving metadata for Chapter ${ch}.`)
            );

            this.progressBars["chapter"].setTasks(saveTasks);

            for (let [chapter, chMetadata] of Object.entries(chaptersInfo)) {
                let chapterPath = seriesDir["archives"][chapter]?.path;
                if (!chapterPath) {
                    this.terminal.appendTextBox(`^Y[Warn]^ Could not find the directory/archive for ${seriesInfo["ComicInfo"].Series || seriesInfo.seriesName} - Chapter ${chapter}. Skipping.`);
                    this.progressBars["chapter"].progress();
                    continue;
                }

                let origMetadata = seriesDir["archives"][chapter]?.metadata || {};
                let fullMetadata = this.metadataProvider.mergeComicInfo(
                    origMetadata,
                    seriesInfo,
                    chMetadata,
                    { "Notes": "Metadata saved using m-info.js" }
                );
                await archive.saveComicMetadata(fullMetadata, seriesDir["archives"][chapter].path);
                this.progressBars["chapter"].progress();
            }

            this.terminal.appendTextBox(`^G[Info]^ Done updating chapter metadata for ${seriesInfo["ComicInfo"].Series || seriesInfo.seriesName}.`);
        }

        if (this.config.CREATE_SERIES_JSON) {
            await archive.saveSeriesJSON(seriesInfo["SeriesInfo"], seriesDir.path);
            this.progressBars["chapter"].progress();
            this.terminal.appendTextBox(`^G[Info]^ Done saving series.json file for ${seriesInfo["ComicInfo"].Series || seriesInfo.seriesName}.`);
        }

        this.progressBars["main"].progress();
    }

    async getCovers(seriesDir, seriesInfo) {
        if (this.config.SAVE_SERIES_COVER || this.config.SAVE_VOLUME_COVER) {
            return await this.metadataProvider.getCovers(seriesInfo.id, this.progressBars["cover"]);
        }
        else {
            this.progressBars["cover"].setTasks([]);
            this.progressBars["cover"].progress();
        }
    }

    async saveCovers(seriesDir, seriesInfo, coversInfo) {
        if (this.config.SAVE_SERIES_COVER || this.config.SAVE_VOLUME_COVER) {
            if (!coversInfo || !Object.keys(coversInfo).length) {
                this.terminal.appendTextBox(`^Y[Warn]^ Could not find any cover results for ${seriesInfo["ComicInfo"].Series || seriesInfo.seriesName}. Skipping.`);
                this.progressBars["cover"].setTasks([]);
                this.progressBars["cover"].progress();
            }
            else {
                let coverTasks = [];
                if (this.config.SAVE_SERIES_COVER) {
                    coverTasks.push("Saving Main Cover Art");
                }
                if (this.config.SAVE_VOLUME_COVER) {
                    coverTasks = coverTasks.concat(
                        Object.keys(coversInfo)
                            .filter((vol) => vol !== "main")
                            .map((vol) => `Saving Cover Art for Volume #${vol}`)
                    );
                }

                this.progressBars["cover"].setTasks(coverTasks);

                if (this.config.SAVE_SERIES_COVER && coversInfo["main"]) {
                    let coverStream = await this.metadataProvider.getCoverStream(seriesInfo.id, coversInfo["main"]);
                    await archive.saveComicCover(coversInfo["main"], coverStream, seriesDir.path, "cover");
                    this.progressBars["cover"].progress();
                    delete coversInfo["main"];
                }
                if (this.config.SAVE_VOLUME_COVER && coversInfo) {
                    let volChapters = this.metadataProvider.getFirstChapters(seriesDir["archives"]);

                    for (let [volume, volCover] of Object.entries(coversInfo)) {
                        if (!volChapters[volume] || !volCover) {
                            this.progressBars["cover"].progress();
                            continue;
                        }

                        let coverStream = await this.metadataProvider.getCoverStream(seriesInfo.id, volCover);
                        if (coverStream) {
                            await archive.saveComicCover(volCover, coverStream, volChapters[volume].path, volChapters[volume].path);
                        }
                        this.progressBars["cover"].progress();
                    }
                }
                this.terminal.appendTextBox(`^G[Info]^ Done Updating Covers for ${seriesInfo["ComicInfo"].Series || seriesInfo.seriesName}.`);
            }
        }
        this.progressBars["main"].progress();
    }

    createAllProgressBars() {
        let mainProgressBar = this.terminal.createProgressBar({
            title: "Updating Series",
            type: "main",
            tasks: [
                "Searching for series metadata...",
                "Searching for chapter metadata...",
                "Saving Chapter Metadata...",
                "Searching for covers...",
                "Saving covers..."
            ],
            pos: { x: 0, y: 3 }
        });

        let providerProgressBar = this.terminal.createProgressBar({
            title: "Searching for metadata...",
            type: "providers",
            pos: { x: 0, y: 2 }
        });

        let chapterProgressBar = this.terminal.createProgressBar({
            title: "Saving Chapter Metadata...",
            type: "chapters",
            pos: { x: 0, y: 1 }
        });

        let coverProgressBar = this.terminal.createProgressBar({
            title: "Saving Covers...",
            type: "covers",
            pos: { x: 0, y: 0 }
        });

        return {
            "main": mainProgressBar,
            "provider": providerProgressBar,
            "chapter": chapterProgressBar,
            "cover": coverProgressBar
        };
    }
}

module.exports = Tagger;