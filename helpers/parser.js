const { XMLParser, XMLBuilder, } = require("fast-xml-parser");

const xmlParser = new XMLParser();
const xmlBuilder = new XMLBuilder();

class Parser {
    constructor(config = {}) {
        this.config = config;
    }

    parseFilename(filename, seriesName = "") {
        let volume = "";
        let chapter = "";

        const volRegex = /[\s_\-\(]v(?:o(?:lume)?)?[,._]*[\s0]*(?<volume>[\d.\-x#]+)/i;
        const chapterRegex = /[\s_\-\(]c(?:h?|(?:apter)?)[,._]*[\s0]*(?<chapter>[\d.\-x#]+)/i;

        volume = volRegex.exec(filename)?.[1] || "0";
        chapter = chapterRegex.exec(filename)?.[1] || "0";

        volume = volume.replace(/[^\d]+/g, '.')
        chapter = chapter.replace(/[^\d]+/g, '.')

        return {
            series: seriesName,
            volume: volume,
            chapter: chapter
        };
    }

    parse(xml) {
        var obj = xmlParser.parse(xml);
        return obj;
    }

    objToXML(obj) {
        let res = {
            ComicInfo: {
                Notes: "Created using m-info.js"
            }
        };

        for (var key in obj) {
            if (obj[key]) res["ComicInfo"][key] = obj[key];
        }

        return xmlBuilder.build(obj);
    }
}

module.exports = Parser;