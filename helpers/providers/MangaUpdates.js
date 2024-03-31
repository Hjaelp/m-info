class MangaUpdates {
    static async getMangaId(req, seriesName) {
        let response = await req.post("https://api.mangaupdates.com/v1/series/search", { "search": seriesName, "orderby": "score" }).catch(function (err) {
            console.error("getMangaId() ERR:", err);
            return false;
        });

        response = response.data;

        if (!response || !response.results || !response.results.length) return false;

        response = response.results[0].record;

        return response.series_id;
    }
    static async getInfo(req, seriesName) {
        let seriesID = await MangaUpdates.getMangaId(req, seriesName);
        if (!seriesID) return false;

        let response = await req.get(`https://api.mangaupdates.com/v1/series/${seriesID}`).catch(function (err) {
            console.error("getMangaInfo() ERR:", err);
            return false;
        });

        response = response.data;

        if (!response) return false;

        //let allTitles = Object.assign({}, ...response.attributes.altTitles, response.attributes.title);
        let chapterCount = response.latest_chapter;
        let seriesTitle = { "en": response.title };
        let description = { "en": response.description?.replace(/<[^>]*>/g, " ").trim() };
        let isManga = "YesAndRightToLeft";
        let tags = response.categories.filter((obj) => obj.votes >= 5 && (obj.votes_minus / obj.votes_plus < 0.25)).map((obj) => obj.category);
        let genre = response.genres.map((obj) => obj.genre);
        let contentRating = this.getAgeRating(genre);
        let author = response.authors.find(rel => rel.type === "Author")?.name;
        let artist = response.authors.find(rel => rel.type === "Artist")?.name;
        let publisher = response.publishers.sort((a, b) => {
            return b.type === "Original";
        })[0]?.["publisher_name"];
        let status = response.completed ? "Ended" : "Continuing";
        let publishedYear = response.year;

        return {
            "id": seriesID,
            "Chapters": chapterCount,
            "Series": seriesTitle,
            "Summary": description,
            "Genre": genre,
            "Tags": tags,
            "AgeRating": contentRating,
            "Author": author,
            "Artist": artist,
            "Publisher": publisher,
            "Status": status,
            "PublishedYear": publishedYear,
            "Manga": isManga
        };
    }

    static async getChapters(req, seriesID, languages) {
        return {};
    }

    static async getCovers(req, seriesID) {
        let response = null;

        response = await req.get(`https://api.mangaupdates.com/v1/series/${seriesID}`).catch(function (err) {
            console.error("getMangaCover() ERR:", err);
        });

        response = response?.data;

        if (!response || !response.results || !response.results.length) return false;

        let cover = response.image;

        if (cover && cover.width > 600)
            return { "main": cover.url };
        else
            return { "main": null };
    }

    static async getCoverStream(req, seriesID, url) {
        const response = await req({
            "method": "GET",
            "url": url,
            "responseType": "stream"
        }).catch((err) => {
            console.error("getMangaCover() Err:", err);
        });

        if (!response || !response.data) return null;
        return response.data;
    }

    static getAgeRating(data) {
        let genre = data.join(" ");
        if (/(adult|hentai|smut|lolicon|shotacon)/i.test(genre)) return "Adults Only 18+";
        else if (/(mature|seinen|josei|yaoi|yuri)/i.test(genre)) return "MA15+";
        else if (/(ecchi|shoujo ai|shounen ai|psychological|horror|harem|tragedy)/i.test(genre)) return "Teen";
        else return "Everyone";
    }
}

module.exports = MangaUpdates;