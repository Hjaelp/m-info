const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const parser = new (require("./parser.js"));

class Archive {
    static async walkDirs(dir) {
        let seriesDir = {};

        const ents = await fs.promises.readdir(dir, { withFileTypes: true, recursive: true });
        for (let ent of ents) {
            let entPath = path.resolve(ent.parentPath, ent.name);
            if (!ent.isDirectory()) {
                let parentBasename = path.basename(ent.parentPath);
                if (!seriesDir[parentBasename]) {
                    seriesDir[parentBasename] = {
                        seriesName: parentBasename,
                        path: ent.parentPath,
                        archives: [],
                        metadata: {},
                        dirXML: false
                    };
                }

                let extension = path.extname(entPath);
                if (extension === ".cbz") {
                    let parsedFilename = parser.parseFilename(path.parse(ent.name).name);

                    let cinfo = await this.getComicMetadata(entPath, true);
                    seriesDir[parentBasename].archives[parsedFilename.chapter] = {
                        path: entPath,
                        volume: parsedFilename.volume,
                        chapter: parsedFilename.chapter,
                        metadata: cinfo.metadata
                    };
                }
                else if (ent.name.toLowerCase() === "comicinfo.xml") {
                    seriesDir[parentBasename].dirXML = true;
                    let cinfo = await this.getComicMetadata(entPath, false);
                    seriesDir[parentBasename].metadata = cinfo.metadata;
                }
            }
        }

        return seriesDir;
    }

    static async getDirs(dir) {
        let res = [];
        const ents = await fs.promises.readdir(dir, { withFileTypes: true });

        for (let ent of ents) {
            if (ent.isDirectory()) {
                res.push(ent.name);
            }
        }

        return res;
    }

    static readZip(filePath) {
        const jsZIP = new JSZip();
        return new JSZip.external.Promise(function (resolve, reject) {
            fs.readFile(filePath, function (err, data) {
                if (err) {
                    console.log("readZip() ERR:", err);
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        }).then(function (data) {
            return jsZIP.loadAsync(data);
        });
    }

    static async getComicMetadata(filePath, isZip = false) {
        let resp = {
            metadata: {},
            xmlinfo: false
        };

        if (isZip) {
            try {
                await this.readZip(filePath).then(async (zipData) => {
                    await zipData.file("ComicInfo.xml")?.async("string").then((xml) => {
                        let parsed = parser.parse(xml);
                        resp.metadata = parsed;
                        resp.xmlinfo = true;
                    }) || (resp.xmlinfo = false);

                    resp.metadata.pages = 0;
                    zipData.forEach((fp) => {
                        let ext = path.extname(fp).toLowerCase();
                        if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].indexOf(ext) > -1) {
                            resp.metadata.pages += 1;
                        }
                    });
                });
            }
            catch (err) {
                console.log("getComicMetadata() ERR:", err, filePath);
                return false;
            }
        }
        else {
            let xml = await fs.promises.readFile(filePath, "utf8");
            let parsed = parser.parse(xml);
            resp.metadata = parsed;
            resp.xmlinfo = true;

            let pages = await fs.promises.readdir(path.dirname(filePath), { withFileTypes: true });
            pages = pages.filter((file) => {
                let fn = file.name.toLowerCase();
                let ext = path.extname(fn).toLowerCase();
                if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].indexOf(ext) > -1 && !/^cover/i.test(fn)) return true;
                else return false;
            });
            console.log(`Found ${pages.length} pages in ${path.dirname(filePath)}`);
            resp.metadata.pages = pages.length;
        }

        return resp;
    }

    static async saveComicMetadata(obj, filePath, useTemp) {
        var xml = parser.objToXML(obj);

        const isZip = [".cbz", ".zip"].indexOf(path.extname(filePath).toLowerCase()) > -1;

        if (isZip) {
            await this.readZip(filePath).then(async (zipData) => {
                zipData.file("ComicInfo.xml", xml);
                
                let dir, fn, tmpFn;
                if (useTemp) {
                    dir = path.dirname(filePath);
                    fn = path.basename(filePath);
                    tmpFn = fn + ".tmp";
                    filePath = path.join(dir, tmpFn);
                }
                await zipData.generateNodeStream({ type: "nodebuffer" })
                    .pipe(fs.createWriteStream(filePath))
                    .on("finish", async () => { 
                        if (useTemp) {
                            await fs.promises.unlink(path.join(dir, fn));
                            await fs.promises.rename(path.join(dir, tmpFn), path.join(dir, fn));
                        }
                    });
            }).catch((err) => {
                console.log("saveComicMetadata() ERR:", err, filePath);
            });
        }
        else return await fs.promises.writeFile(path, xml);
    }

    static async saveSeriesJSON(obj, dir) {
        let filename = path.join(dir, "series.json");
        return await fs.promises.writeFile(filename, JSON.stringify(obj));
    }

    static async saveComicCover(imageFilename, imageStream, coverPath, destFilename) {
        destFilename = path.parse(destFilename).name;
        const coverExt = path.extname(imageFilename).toLowerCase();

        const stat = await fs.promises.lstat(coverPath);
        if (stat.isDirectory()) {
            coverPath = path.join(coverPath, `${destFilename}${coverExt}`);
        }
        else {
            coverPath = path.join(path.dirname(coverPath), `${destFilename}${coverExt}`);
        }

        const writer = fs.createWriteStream(coverPath);

        imageStream.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => {
                //console.log('Image saved successfully');
                resolve();
            }).on("error", (err) => {
                console.error("Error saving image", coverPath, err);
                reject(err);
            });
        });
    }
}

module.exports = Archive;