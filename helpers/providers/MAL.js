class MAL {
    static async getInfo(req, seriesName) {
        let response = await req.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(seriesName)}&limit=1`).catch(function (err) {
            console.error("getMangaInfo() ERR:", err);
            return false;
        });

        response = response.data;

        if (!response || !response.data || !response.data.length) return false;

        response = response.data[0];

        let langMap = {
            "English": "en",
            "Japanese": "ja",
            "Default": "ja-ro"
        }
        let titles = response.titles.map((prop) => {
            let language = prop.type;
            if (!langMap[language]) return false;
            return {
                [langMap[language]]: prop.title
            };
        }).filter((prop) => !!prop);

        let relevant = Object.values(titles).join(' ').toLowerCase().includes(seriesName.toLowerCase());
        //if (!relevant) return false; // Jikan's Search API doesn't work well. 

        let id = response.mal_id;
        let chapterCount = response.chapters || 1;
        let volumeCount = response.volumes && parseInt(response.volumes);
        let seriesTitle = Object.assign({}, ...titles);
        let description = response.synopsis;
        let isManga = 'YesAndRightToLeft';
        let demographics = response.demographics.map((prop)=>prop.name) || [];
        let genre = demographics.concat(response.genres
            .map(prop => prop.name))
            .sort();
        let tags = response.themes
            .map(prop => prop.name)
            .sort();
        let contentRating = this.getAgeRating(genre);
        let author = response.authors.map((prop) => prop.name).join(', ') || '';
        //let artist = response.artists.map((prop) => prop.name).join(', ') || '';
        let status = ["Finished", "Discontinued"].includes(response.status) ? "Ended" : "Continuing";

        let publishedYear = null;
        let publicationFrom = response.published?.from;
        let publicationTo = response.published?.to;
        if (response.published?.from){
            publicationFrom = new Date(response.published?.from);
            publishedYear = publicationFrom.getFullYear();
            publicationFrom = publicationFrom.toLocaleDateString("en-US", { month: 'long' }) + 
                              " " + 
                              publicationFrom.toLocaleDateString("en-US", { year: 'numeric' });
        }

        if (response.published?.to) {
            publicationTo = new Date(response.published?.to);
            publicationTo = publicationTo.toLocaleDateString("en-US", { month: 'long' }) + 
                            " " + 
                            publicationTo.toLocaleDateString("en-US", { year: 'numeric' });
        }
        let publicationRun = (publicationFrom || "?") + " - " + (publicationTo || "Present");

        return {
            "id": id,
            "Chapters": chapterCount,
            "Volumes": volumeCount,
            "Series": seriesTitle,
            "Summary": description,
            "Genre": genre,
            "AgeRating": contentRating,
            "Author": author,
            //"Artist": artist,
            "Status": status,
            "PublicationRun": publicationRun,
            "PublishedYear": publishedYear,
            "Manga": isManga
        }
    }

    static async getChapters(req, seriesID, languages) {
        return {};
    }

    static async getCovers(req, seriesID) {
        let response = null;
        let results = null;

        response = await req.get(`https://api.jikan.moe/v4/manga/${seriesID}/pictures`).catch(function (err) {
            console.error("getMangaCover() ERR:", err);
        });

        response = response?.data;

        if (!response || !response.data || !response.data.length) return false;

        results = response.data.map((prop) => prop.jpg?.large_image_url)
                               .filter((url) => !!url);
            
        return {
            "main": results[0]
        };
    }

    static async getCoverStream(req, seriesID, url) {
        const response = await req({
            "method": 'GET',
            "url": url,
            "responseType": 'stream'
        }).catch((err) => {
            console.error("getMangaCover() Err:", err);
        })

        if (!response || !response.data) return null;
        return response.data;
    }

    static getAgeRating(data) {
        let genre = data.join(' ');
        if (/(hentai|erotica)/i.test(genre)) return 'Adults Only 18+';
        else if (/(seinen|josei)/i.test(genre)) return 'MA15+';
        else if (/(ecchi|boys love|girls love|psychological|horror|harem)/i.test(genre)) return 'Teen'
        else return 'Everyone';
    }
}

module.exports = MAL;