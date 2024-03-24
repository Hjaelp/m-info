class MangaDex {
    static async getInfo(req, seriesName) {
        let response = await req.get(`https://api.mangadex.org/manga?title=${encodeURIComponent(seriesName)}&order%5Brelevance%5D=desc&includes[]=author&includes[]=artist&includes[]=cover_art&limit=1`).catch(function (err) {
            console.error("getMangaInfo() ERR:", err);
            return false;
        });

        response = response.data;

        if (!response || !response.data || !response.data.length) return false;

        response = response.data[0];

        let id = response.id;
        let chapterCount = response.attributes.lastChapter||1;
        let volumesCount = response.attributes.lastVolume && parseInt(response.attributes.lastVolume);
        let seriesTitle = Object.assign({}, {"ja-ro": response.attributes.title?.en}, ...response.attributes.altTitles)
        let description = response.attributes.description;
        let contentRating = this.getAgeRating(response.attributes.contentRating); // TODO: map content rating with cinfo values.
        let isManga = 'YesAndRightToLeft';
        let demographic = response.attributes.publicationDemographic || '';
        demographic = demographic.charAt(0).toUpperCase() + demographic.substr(1);
        let genre = ([demographic]).concat(response.attributes.tags
            .map(tag => tag.attributes.group === 'genre' && tag.attributes.name?.en))
            .filter(genre => !!genre).sort();
        let tags = response.attributes.tags
            .map(tag => tag.attributes.group !== 'genre' && tag.attributes.name?.en)
            .filter(tag => !!tag).sort();
        //let characters = 
        let author = response.relationships.find(relationship => relationship.type === 'author').attributes.name;
        let artist = response.relationships.find(relationship => relationship.type === 'artist').attributes.name;
        let publishedYear = response.attributes.year;
        let status = ["completed", "cancelled"].includes(response.attributes.status) ? "Ended" : "Continuing";

        return {
            "id": id,
            "Chapters": chapterCount,
            "Volumes": volumesCount,
            "Series": seriesTitle,
            "Summary": description,
            "AgeRating": contentRating,
            "Genre": genre,
            "Tags": tags,
            "Author": author,
            "Artist": artist,
            "PublishedYear": publishedYear,
            "Status": status,
            "Manga": isManga
        }
    }

    static async getChapters(req, seriesID, acceptableLanguages) {
        let offset = 0;
        let results = {};
        let moreResults = false;
        let response = null;

        acceptableLanguages = acceptableLanguages.map((lang) => ("translatedLanguage[]=" + lang));

        do {
            response = await req.get(`https://api.mangadex.org/manga/${seriesID}/feed?${acceptableLanguages.join('&')}&limit=100&offset=${offset}`).catch(function (err) {
                console.error("getMangaChapters() ERR:", err);
            });

            response = response.data;

            if (!response || !response.data || !response.data.length) break;

            for (let chapter of response.data) {
                const volumeNum = chapter.attributes.volume || '0';
                const chapterNum = chapter.attributes.chapter || '0';

                if (!results[chapterNum])
                    results[chapterNum] = {};

                let title = '';
                let publishedDate = null;

                if (chapter.attributes.chapter && chapter.attributes.title)
                    title = `Chapter ${chapterNum} - ${chapter.attributes.title}`;
                else if (!chapter.attributes.title)
                    title = `Chapter ${chapterNum}`;
                else
                    title = chapter.attributes.title;

                if (chapter.attributes.publishAt) {
                    publishedDate = new Date(chapter.attributes.publishAt);
                    if (publishedDate.getFullYear() > new Date().getFullYear()) publishedDate = new Date(chapter.attributes.readableAt);
                }

                results[chapterNum][chapter.attributes.translatedLanguage] = {
                    "Title": title,
                    "Volume": volumeNum,
                    "Chapter": chapterNum,
                    "Year": publishedDate.getFullYear(),
                    "Month": publishedDate.getMonth() + 1,
                    "Day": publishedDate.getDate(),
                    "Pages": chapter.attributes.pages
                }
            }

            if (response.total > response.limit + offset) {
                offset += (response.data.limit-0||100);
                moreResults = true;
            }
            else moreResults = false;
        } while (response.data.length && moreResults);

        return results;
    }

    static async getCovers(req, seriesID) {
        let offset = 0;
        let results = {};
        let moreResults = false;
        let response = null;

        do {
            response = await req.get(`https://api.mangadex.org/cover?manga%5B%5D=${seriesID}&limit=100&offset=${offset}&order%5Bvolume%5D=asc`).catch(function (err) {
                console.error("getMangaCover() ERR:", err);
            });

            response = response?.data;

            if (!response || !response.data || !response.data.length) break;

            if (!results['main']) results['main'] = response.data[0]?.attributes.fileName;
            for (let cover of response.data) {
                let volume = cover.attributes.volume || '0';

                if (!results[volume]) {
                    results[volume] = cover.attributes.fileName;
                }
            }

            if (response.data.total > response.data.limit + offset) {
                offset += response.data.limit;
                moreResults = true;
            }
            else moreResults = false;
        } while (response.data.length && moreResults);

        return results;
    }

    static async getCoverStream(req, seriesID, filename) {
        const response = await req({
            "method": 'GET',
            "url": `https://uploads.mangadex.org/covers/${seriesID}/${filename}`,
            "responseType": 'stream'
        }).catch((err) => {
            console.error("getMangaCover() Err:", err);
        })

        if (!response || !response.data) return null;
        return response.data;
    }

    static getAgeRating(data) {
        let ratingMap = {
            "safe": "Everyone",
            "suggestive": "Teen",
            //"erotica": "MA15+",
            "erotica": "Adults Only 18+"
        }

        return ratingMap[data] || data;
    }
}

module.exports = MangaDex;