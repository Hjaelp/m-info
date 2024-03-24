const axios = require('axios');
const { Agent } = require('https');

const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class Manga {
    constructor(config) {
        this.config = config;
        this.availableProviders = {};
        this.selectedProviders = {};

        this.apiInstance = axios.create({
            timeout: 60000, 
            httpsAgent: new Agent({keepAlive: true}),
        });

        for (let provider of this.config.METADATA_PROVIDERS) {
            try {
                this.availableProviders[provider] = require(`./providers/${provider}.js`);
            }
            catch (e) {
                console.log(`Error loading provider ${provider}`, e);
            }
        }
    }

    setProviders(providerNames) {
        if (!providerNames) providerNames = this.config.METADATA_PROVIDERS;
        
        this.selectedProviders = {};
        for (let provider of providerNames){
            if (this.availableProviders[provider]) {
                this.selectedProviders[provider] = this.availableProviders[provider];
            }
        }
    }

    async getInfo(seriesName, progressBar, preview) {
        let res = {};
        let mInfo = {};
        let mIds = {};
        let providerNames = Object.keys(this.selectedProviders);

        let progressItems = providerNames.map((provider) => {
            return `Searching ${provider} for metadata...`;
        });
        progressBar.setTasks(progressItems);
        
        for (let provider of providerNames) {
            let resp = await this.selectedProviders[provider].getInfo(this.apiInstance, seriesName);
            if (resp) mInfo[provider] = resp;
            if (resp.id) mIds[provider] = resp.id;
            
            progressBar.progress();

            await sleep(1000);
        }

        if (!Object.keys(mInfo).length) {
            return false;
        }

        if (preview){
            for (let provider of Object.keys(mInfo)){
                if (!provider || !mInfo[provider] || !mInfo[provider]["Series"]) continue;
                res[provider] = {
                    "id": mIds[provider],
                    "Series": this.getPreferredLang(mInfo[provider]["Series"], "Series") || "?",
                    "Genre": mInfo[provider].Genre?.join(", ") || "?",
                    "Author": mInfo[provider].Author || "?"
                }
            }
            return res;
        }

        let chapterCount = this.getPreferredData(mInfo, 'Count');

        let genre = this.config['METADATA_AGGREGATE'] ? this.aggregateField(mInfo, 'Genre') 
                                                      : this.getPreferredData(mInfo, 'Genre');
        let tags = this.config['METADATA_AGGREGATE'] ? this.aggregateField(mInfo, 'Tags')
                                                     : this.getPreferredData(mInfo, 'Tags');

        let ageRating = this.getPreferredData(mInfo, 'AgeRating');

        res = {
            "id": mIds,
            "Count": chapterCount,
            "ComicInfo": {
                "Series": this.getPreferredData(mInfo, 'Series'),
                "Count": this.getPreferredData(mInfo, 'Chapters'),
                "AlternateSeries": this.getPreferredData(mInfo, 'Series', 1),
                "Summary": this.getPreferredData(mInfo, 'Summary'),
                "AgeRating": ageRating,
                "Genre": genre.join(', '),
                "Tags": tags.join(', '),
                "Author": this.getPreferredData(mInfo, 'Author'),
                "Artist": this.getPreferredData(mInfo, 'Artist'),
                "Manga": this.getPreferredData(mInfo, 'Manga')
            }
        }

        if (this.config.CREATE_SERIES_JSON){
            let mylarAgeRating = {
                "Adults Only 18+": "Adult",
                "MA15+": "15+",
                "Teen": "12+",
                "Everyone": "All Ages"
            };

            res["SeriesInfo"] = {
                "type": "comicSeries",
                "imprint": null,
                "comicid": null,
                "name": this.getPreferredData(mInfo, 'Series'),
                "description_text": this.getPreferredData(mInfo, 'Summary') || null,
                "description_formatted": null,
                "booktype": "Print",
                "collects": null,
                "comic_image": null,
                "publisher": this.getPreferredData(mInfo, 'Publisher') || null,
                "volume": this.getPreferredData(mInfo, 'Volumes') || null,
                "total_issues": this.getPreferredData(mInfo, 'Chapters') || null,
                "year": this.getPreferredData(mInfo, 'PublishedYear') || null,
                "publication_run": this.getPreferredData(mInfo, 'PublicationRun') || null,
                "age_rating": mylarAgeRating[ageRating] || null,
                "status": this.getPreferredData(mInfo, 'Status') || null
            };
        }

        return res;
    }

    async getChapters(seriesID, progressBar) {
        let providers = this.config['METADATA_PREFERENCE']['ChapterDetails'] || this.config['METADATA_PREFERENCE']['default'];
        let acceptableLanguages = this.config['METADATA_LANG']['ChapterDetails'] || this.config['METADATA_LANG']['default'];

        let progressItems = Object.keys(providers).map((provider) => {
            return `Searching ${provider} for chapter metadata...`;
        });
        progressBar.setTasks(progressItems);

        for (let provider of providers) {
            if (!seriesID[provider] || !this.selectedProviders[provider].getChapters) {
                progressBar.progress();
                continue;
            }

            let resp = await this.selectedProviders[provider].getChapters(this.apiInstance, seriesID[provider], acceptableLanguages);

            for (let chapter of Object.keys(resp)) {
                resp[chapter] = this.getPreferredLang(resp[chapter], 'chapterDetails') || {};
            }

            progressBar.progress();
            if (resp) return resp;
        }
    }

    async getCovers(seriesID, progressBar) {
        let mCovers = {};
        let providers = this.config['METADATA_PREFERENCE']['Cover'] || this.config['METADATA_PREFERENCE']['default'];

        let progressItems = Object.keys(providers).map((provider) => {
            return `Searching ${provider} for cover metadata...`;
        });
        progressBar.setTasks(progressItems);

        for (let provider of providers) {
            if (!this.selectedProviders[provider]) continue;

            let resp = await this.selectedProviders[provider].getCovers(this.apiInstance, seriesID[provider]);
            progressBar.progress();

            if (resp) return resp; //mCovers[provider] = resp;
        }
    }

    async getCoverStream(seriesID, filename) {
        let providers = this.config['METADATA_PREFERENCE']['Cover'] || this.config['METADATA_PREFERENCE']['default'];
        for (let provider of providers) {
            if (!this.selectedProviders[provider]) continue;

            let resp = await this.selectedProviders[provider].getCoverStream(this.apiInstance, seriesID[provider], filename);
            if (resp) return resp;
        }
    }

    mergeComicInfo(origInfo, ...args) {
        let res = origInfo || {};
        if (res['ComicInfo']) res = res['ComicInfo'];

        for (let i = 0; i < args.length; i++) {
            let newInfo = args[i];
            if (newInfo['ComicInfo']) newInfo = newInfo['ComicInfo'];

            for (let key of Object.keys(newInfo)) {
                if ((this.config['METADATA_OVERWRITE'] || !res[key]) && newInfo[key]){
                    res[key] = newInfo[key];
                }
            }
        }

        return {
            "ComicInfo": res
        };
    }

    aggregateField(data, field) {
        let res = Object.values(data).map((prov) => prov[field]).flat()
                        .filter((val, i, arr) => 
                            !!val && arr.findIndex((f) => (val + '').toLowerCase() === (f + '').toLowerCase()) === i
                        )
                        .sort();
        return res;
    }

    getPreferredData(data, field, skipFirst = 0){
        let i = 0;
        let checkLang = Object.keys(this.config.METADATA_LANG).includes(field);
        let preferredProviders = this.config.METADATA_PREFERENCE[field] || this.config.METADATA_PREFERENCE["default"];
        for (let provider of preferredProviders) {
            if (data[provider]?.[field]) {
                let preferredData = data[provider][field];
                if (checkLang){
                    preferredData = this.getPreferredLang(preferredData, field, skipFirst);
                    if (preferredData) return preferredData;
                }
                if (skipFirst > i) i++;
                else return preferredData;
            }
        }
        return false;
    }

    getPreferredLang(data, field, skipFirst = 0){
        let i = 0;
        let preferedLangs = this.config.METADATA_LANG[field] || this.config.METADATA_LANG["default"];

        for (let lang of preferedLangs) {
            if (data[lang]) {
                if (skipFirst > i) i++;
                else return data[lang];
            }
        }
        return false;
    }

    getFirstChapters(chapters){
        let res = {};
        let lastVol = -1;

        for (let chapter of chapters) {
            if (!chapter || !chapter.hasOwnProperty('volume')) continue;
            let chapterNum = chapter.chapter-0;
            let volumeNum = chapter.volume-0;

            if (volumeNum > lastVol){
                res[volumeNum] = {
                    "chapter": chapterNum,
                    "volume": volumeNum,
                    "path": chapter.path
                };
                lastVol = volumeNum;
            }
        }

        return res;
    }
}

module.exports = Manga