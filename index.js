const config = require('./config.js');

const Terminal = require('./helpers/terminal.js');
const Archive = require('./helpers/archive.js');
const Manga = require('./helpers/manga.js');

const terminal = new Terminal(config);
const archive = new Archive(config);
const manga = new Manga(config);

const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function start(){
    let resp = await terminal.showMainMenuPrompt();
    let dir = null;

    if (!resp) return;

    if (resp.updateMode === "all") {
        dir = config.BASE_DIR;
    }
    else if (resp.updateMode === "manual") {
        dir = await terminal.showDirectoryPrompt(config.BASE_DIR, archive.getDirs);
    }

    updateBooks(dir, !!resp.manualMode);
}

async function updateBooks(dir, previewMode = false){
    terminal.showUpdateScreen();

    terminal.appendTextBox("^G[Info]^ Searching for series in the base directory...");
    let seriesDir = await archive.walkDirs(dir);

    let i = 0;
    let totalSeries = Object.keys(seriesDir).length;    
    for (let series of Object.values(seriesDir)) {
        let mainProgressBar = terminal.createProgressBar({
            title: `Updating ${series.seriesName}`,
            type: 'main',
            tasks: [
                "Searching for series metadata...",
                "Searching for chapter metadata...",
                "Saving Chapter Metadata...",
                "Searching for covers...",
                "Saving covers..."
            ],
            pos: { x: 0, y: 3 }
        });

        terminal.appendTextBox(`^G[Info]^ Searching for ${series.seriesName}`);
        let providerProgressBar = terminal.createProgressBar({
            title: "Searching for metadata...",
            type: 'provider',
            pos: { x: 0, y: 2 }
        });
        await sleep(1000);

        manga.setProviders();
        let mangaInfo = await manga.getInfo(series.seriesName, providerProgressBar, previewMode);
        let manualModeProviders = [];

        if (previewMode) {
            manualModeProviders = await terminal.showManualProviderWindow(mangaInfo);
            if (!manualModeProviders) {
                return start();
            }
            else if (!manualModeProviders.length){
                terminal.appendTextBox(`^Y[Warn]^ No metadata providers for ${series.seriesName} have been selected. Skipping series.`);
                continue;
            }
            else {
                providerProgressBar.reset();
                manga.setProviders(manualModeProviders);
                mangaInfo = await manga.getInfo(series.seriesName, providerProgressBar, false);
            }
        }

        if (!mangaInfo || !Object.keys(mangaInfo).length) {
            terminal.appendTextBox(`^Y[Warn]^ Could not find any results for ${series.seriesName}. Skipping`);
            continue;
        }

        mainProgressBar.progress();

        await sleep(5000);

        terminal.appendTextBox(`^G[Info]^ Found Series ${mangaInfo['ComicInfo'].title || series.seriesName}. Searching chapters...`)

        let chapterProgressBar = terminal.createProgressBar({
            title: "Saving Chapter Metadata...",
            type: 'chapters',
            pos: { x: 0, y: 1 }
        }); 

        let saveTasks = [];
        if (config.CREATE_SERIES_JSON) {
            saveTasks.push("Saving series.json...");
        }

        let chaptersInfo = await manga.getChapters(mangaInfo.id, chapterProgressBar);
        if (!chaptersInfo) {
            terminal.appendTextBox(`^Y[Warn]^ Could not find any chapter results for ${series.seriesName}. Skipping.`);
            chapterProgressBar.setTasks(saveTasks);
        }
        else {
            terminal.appendTextBox(`^G[Info]^ Found ${Object.keys(chaptersInfo).length} chapters for ${mangaInfo['ComicInfo'].title || series.seriesName}.`);

            mainProgressBar.progress();

            Object.keys(chaptersInfo).map((ch) => `Saving metadata for Chapter ${ch}.`);

            chapterProgressBar.setTasks(saveTasks);

            for (let [chapter, chMetadata] of Object.entries(chaptersInfo)) {
                let chapterPath = series['archives'][chapter]?.path;
                if (!chapterPath) {
                    terminal.appendTextBox(`^Y[Warn]^ Could not find the directory/archive for ${series.seriesName} - Chapter ${chapter}. Skipping.`);
                    chapterProgressBar.progress();
                    continue;
                }

                let origMetadata = series['archives'][chapter]?.metadata || {};
                let fullMetadata = manga.mergeComicInfo(
                    origMetadata,
                    mangaInfo,
                    chMetadata,
                    { "Notes": "Metadata saved using m-info.js" }
                );
                await archive.saveComicMetadata(fullMetadata, series['archives'][chapter].path);
                chapterProgressBar.progress();
            }
            
            terminal.appendTextBox(`^G[Info]^ Done updating chapter metadata for ${series.seriesName}.`);
        }

        if (config.CREATE_SERIES_JSON) {
            await archive.saveSeriesJSON(mangaInfo['SeriesInfo'], series.path);
            chapterProgressBar.progress();
            terminal.appendTextBox(`^G[Info]^ Done saving series.json file for ${series.seriesName}.`);
        }

        mainProgressBar.progress();

        await sleep(5000);

        let coverProgressBar = terminal.createProgressBar({
            title: "Saving Covers...",
            type: 'covers',
            pos: { x: 0, y: 0 }
        }); 

        if (config.SAVE_SERIES_COVER || config.SAVE_VOLUME_COVER) {
            let coversInfo = await manga.getCovers(mangaInfo.id, coverProgressBar);
            if (!coversInfo || !Object.keys(coversInfo).length) {
                terminal.appendTextBox(`^Y[Warn]^ Could not find any cover results for ${series.seriesName}. Skipping.`);
                coverProgressBar.setTasks([]);
                coverProgressBar.progress();
            }
            else {
                let coverTasks = [];
                if (config.SAVE_SERIES_COVER){
                    coverTasks.push("Saving Main Cover Art");
                }
                if (config.SAVE_VOLUME_COVER) {
                    coverTasks = coverTasks.concat(
                                        Object.keys(coversInfo)
                                              .filter((vol)=> vol !== "main" )
                                              .map((vol) => `Saving Cover Art for Volume #${vol}`)
                                 );
                }
                terminal.appendTextBox(JSON.stringify(chaptersInfo));
            
                coverProgressBar.setTasks(coverTasks);
            
                if (config.SAVE_SERIES_COVER && coversInfo['main']) {
                    let coverStream = await manga.getCoverStream(mangaInfo.id, coversInfo['main']);
                    await archive.saveComicCover(coversInfo['main'], coverStream, series.path, 'cover');
                    coverProgressBar.progress();
                    delete coversInfo['main'];
                }
                if (config.SAVE_VOLUME_COVER && coversInfo) {
                    let volChapters = manga.getFirstChapters(series['archives']);
                
                    for (let [volume, volCover] of Object.entries(coversInfo)) {
                        if (!volChapters[volume] || !volCover) {
                            coverProgressBar.progress();
                            continue;
                        }
                    
                        let coverStream = await manga.getCoverStream(mangaInfo.id, volCover);
                        if (coverStream) {
                            await archive.saveComicCover(volCover, coverStream, volChapters[volume].path, volChapters[volume].path);
                        }
                        coverProgressBar.progress();
                    }
                }
                terminal.appendTextBox(`^G[Info]^ Done Updating Covers for ${series.seriesName}.`);
            }
        }
        else {
            coverProgressBar.setTasks([]);
            coverProgressBar.progress();
        }
        mainProgressBar.progress();
        terminal.appendTextBox(`\n^GDone updating ${series.seriesName}!^\n`);
        i++;

        if (i < totalSeries) {
            terminal.appendTextBox(`^GContinuing in 5 seconds...^\n\n`);
            await sleep(5000);
            providerProgressBar.hide();
            chapterProgressBar.hide();
            coverProgressBar.hide();
        }
    }

    terminal.appendTextBox('\n^GAll tasks are completed! Press ^BCTRL+R^ ^Gto return to Main Menu.^\n');
}

start();