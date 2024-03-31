const config = {
    BASE_DIR: "/mnt/comics/manga/", // Location of the books

    METADATA_PROVIDERS: ["MangaDex", "MAL", "MangaUpdates"], // List of metadata providers to be used
    METADATA_PREFERENCE: { // List of preferred metadata providers for each field (in order of preference)
        "default": ["MangaDex", "MangaUpdates", "MAL"],
        "Series": ["MangaDex", "MAL"], // Title
        "AlternateSeries": ["MangaDex", "MAL"], // Alternate title
        "ChapterDetails": ["MangaDex"],
        "Volumes": ["MangaUpdates", "MangaDex", "MAL"], // Number of volumes in the series
        "Chapters": ["MangaUpdates", "MangaDex", "MAL"], // Number of chapters in the series
        "Summary": ["MangaUpdates", "MAL", "MangaDex"],
        "Author": ["MangaUpdates", "MangaDex", "MAL"],
        "Artist": ["MangaUpdates", "MangaDex", "MAL"],
        "Genre": ["MangaUpdates", "MAL", "MangaDex"],
        "Tags": ["MangaUpdates", "MangaDex"],
        "AgeRating": ["MangaUpdates", "MangaDex", "MAL"],
        "Cover": ["MangaDex", "MangaUpdates", "MAL"],
        "PublicationRun": ["MAL"],
        "Publisher": ["MangaUpdates"],
        "Status": ["MAL", "MangaDex", "MangaUpdates"] // Whether series is ongoing or completed.
    },
    METADATA_LANG: { // Language of the comics metadata (in order of preference)
        "default": ["en", "ja-ro", "ja"],
        "Series": ["en", "ja-ro", "ja"],
        "AlternateSeries": ["ja-ro", "en", "ja"],
        "Summary": ["en"],
        "chapterDetails": ["en"],
        "description": ["en"]
    },
    METADATA_OVERWRITE: true, // true: overwrite existing metadata fields, false: only add fields that are not already in the metadata.
    METADATA_AGGREGATE: true, // Aggregate metadata (genre and tags only) from multiple providers into one

    SAVE_SERIES_COVER: true, // Save the first cover as the series' main cover.
    SAVE_VOLUME_COVER: true, // Save every volume cover.

    CREATE_SERIES_JSON: true, // Save mylar-style series.json file.
}

module.exports = config;