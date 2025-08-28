import * as platform from "../platform.js";

platform.insert_snpahsots({
    "date": { "start": new Date("2022-01-01"), "end": new Date("2022-01-02") },
    "data": [ { "video": {
        "title": "this is a test video for batch insert snapshots",
        "id": "BV114514", "duration": 114514, "created_at": new Date("2019-11-11"),
        "published_at": new Date("2023-09-11"), "page": 11111, "thumbnail": "test",
        "uploader": { "id": 721812368, "name": "test", "avatar": "test" }
    }, "snapshot_at": new Date("2022-01-01"), "counter": {
        "coin": 114514, "like": 216387, "view": 9827914, "favorite": 1154
    } } ]
});