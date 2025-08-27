import path from "path";
import SQLite3 from "better-sqlite3";
import * as bbvid from "../bilibili/identifier.js";
import { split_group } from "../../../depend/toolkit.js";
import { DatabaseOperator } from "../../../depend/database/operator.js";

const root = path.resolve(".");

const filepath = path.resolve(
    root, "./assets/database/platform.db"
);

const instance = new SQLite3(filepath, {
    "timeout": 5000, "readonly": false
});

const operator = new DatabaseOperator(instance);

const MIC = 8192; // 单次插入标识符最大数量

/**
 * 更新或者插入上传者信息到数据库中
 * 
 * @typedef {Object} Uploader
 * @property {number} id 上传者外部标识符
 * @property {string} name 上传者名称
 * @property {string} avatar 上传者头像
 * 
 * @typedef {Object} Response
 * @property {number} id 上传者内部标识符
 * @property {number} exterior 上传者外部标识符
 * @property {number} update_count 更新次数
 * 
 * @param {(Uploader|Uploader[])} uploaders 需要更新或者插入的上传者信息列表
 * @param {Date} [instance=new Date()] 执行操作的时候的时间
 * @returns {Response[]} 更新或者插入的上传者信息
 */
function upsert_uploader(uploaders, instance = new Date()) {
    if (!Array.isArray(uploaders)) {
        uploaders = [ uploaders ];
    }

    if (uploaders.length > MIC) {
        const responses = [];

        const groups = split_group(uploaders, MIC);

        for (let index = 0; index < groups.length; index++) {
            const result = upsert_uploader(
                groups[index], instance
            );

            responses.push(result);
        }

        return responses.flat(1);
    }

    const record = operator.record();

    const condition = {};
    
    const eid_list = uploaders.map(
        (uploader) => uploader.id
    );

    condition.select = {
        "column": "exterior",
        "restrict": {
            "include": eid_list
        }
    };

    const response = {}, field_list = [
        "id", "exterior", "update_count"
    ];

    response.select = record.select(
        "uploaders", condition.select, {
            "select": field_list
        }
    )[0].flat(2);

    const exist_eid = response.select.map(
        (record) => record.exterior
    );

    const current = instance.toISOString();

    if (exist_eid.length > 0) {
        const condition = {
            "column": "exterior",
            "restrict": {
                "include": exist_eid
            }
        };

        const mapping = {
            "input": Object.fromEntries(uploaders.map(
                (uploader) => [ uploader.id, uploader ]
            )),
            "database": Object.fromEntries(response.select.map(
                (record) => [ record.exterior, record ]
            ))
        };

        const builder = operator.statement().build;

        const generator = (source, field, hanlder) => {
            const _handler = builder.case.abstract.single;

            hanlder ??= (item) => item;

            return (options) => {
                return _handler("exterior", Object.fromEntries(
                    Object.entries(mapping[source]).map(
                        ([ eid, uploader ]) => [
                            eid, hanlder(uploader[field])
                        ]
                    )
                ), options);
            };
        };

        const options = {
            "action": "execute",
            "return_field": field_list
        };

        response.update = record.update(
            "uploaders", condition, {
                "username": generator("input", "name"),
                "avatar": generator("input", "avatar"),
                "update_count": generator("database", "update_count", (item) => item + 1),
                "updated_at": current
            }, options
        )[0].flat(2);
    }
 
    uploaders.insert = uploaders.filter(
        ({ id }) => !exist_eid.includes(id)
    );

    const dataset = [];

    for (let index = 0; index < uploaders.insert.length; index++) {
        const uploader = uploaders.insert[index];

        dataset.push({
            "exterior": uploader.id,
            "username": uploader.name,
            "avatar": uploader.avatar,
            "update_count": 1,
            "updated_at": current,
            "recorded_at": current
        });
    }

    if (dataset.length > 0) {
        const options = {
            "mode": "batch",
            "action": "execute",
            "return_field": field_list
        };
        
        response.insert = record.insert(
            "uploaders", dataset, options
        )[0].flat(2);
    }

    response.insert ??= [];
    response.update ??= [];

    const { update, insert } = response;

    return [ update, insert ].flat(1);
}

/**
 * 更新或者插入视频信息到数据库中
 * 
 * @typedef {Object} Video
 * @property {number} id 视频外部标识符
 * @property {string} title 视频名称
 * @property {string} thumbnail 视频封面
 * @property {number} duration 视频时长
 * @property {number} page 视频页数
 * @property {Uploader} uploader 视频上传者
 * 
 * @property {Date} created_at 视频创建时间
 * @property {Date} published_at 视频更新时间
 * 
 * @typedef {Object} Response
 * @property {number} id 视频内部标识符
 * @property {number} exterior 视频外部标识符
 * @property {number} update_count 更新次数
 * 
 * @param {(Video|Video[])} videos 需要更新或者插入的视频信息列表
 * @param {Date} [instance=new Date()] 执行操作的时候的时间
 * @returns {Response[]} 更新或者插入的视频信息
 */
function upsert_video(videos, instance = new Date()) {
    if (!Array.isArray(videos)) {
        videos = [ videos ];
    }

    if (videos.length > MIC) {
        const responses = [];

        const groups = split_group(videos, MIC);

        for (let index = 0; index < groups.length; index++) {
            const result = upsert_video(
                groups[index], instance
            );

            responses.push(result);
        }

        return responses.flat(1);
    }

    const record = operator.record();

    const condition = {};
    
    const eid_list = videos.map(
        (video) => video.id
    );

    condition.select = {
        "column": "exterior",
        "restrict": {
            "include": eid_list
        }
    };

    const response = {}, field_list = [
        "id", "exterior", "update_count"
    ];

    response.select = record.select(
        "videos", condition.select, {
            "select": field_list
        }
    )[0].flat(2);

    /**
     * @description 已存在的视频外部标识符
     * 
     * @type {number[]}
     */
    const exist_eid = response.select.map(
        (record) => record.exterior
    );

    const current = instance.toISOString();

    const mapping = {
        "input": Object.fromEntries(videos.map(
            (video) => [ video.id, video ]
        )),
        "related": {  
            "uploader": Object.fromEntries(upsert_uploader(
                videos.map((video) => video.uploader), instance
            ).map(({ id, exterior }) => [ exterior, id ])),
        },
        "database": Object.fromEntries(response.select.map(
            (record) => [ record.exterior, record ]
        ))
    };

    mapping.uploader = Object.fromEntries(videos.map((video) => {
        const video_exterior_id = video.id;

        const related = mapping.related.uploader;
        const uploader_exterior_id = video.uploader.id;

        const object = {
            "uploader_id": related[uploader_exterior_id]
        };
        
        return [ video_exterior_id, object ];
    }));

    if (exist_eid.length > 0) {
        const condition = {
            "column": "exterior",
            "restrict": {
                "include": exist_eid
            }
        };

        const builder = operator.statement().build;

        const _handler = builder.case.abstract.single;

        const generator = (source, field, hanlder) => {
            hanlder ??= (item) => item;

            return (options) => {
                return _handler("exterior", Object.fromEntries(
                    Object.entries(mapping[source]).map(
                        ([ eid, uploader ]) => [
                            eid, hanlder(uploader[field])
                        ]
                    )
                ), options);
            };
        };

        const options = {
            "action": "execute",
            "return_field": field_list
        };

        const handler = {
            "date": (item) => item.toISOString().replaceAll(".000", ""),
            "increase": (item) => item + 1
        };

        response.update = record.update(
            "videos", condition, {
                "title": generator("input", "title"),
                "thumbnail": generator("input", "thumbnail"),
                "duration": generator("input", "duration"),
                "page_count": generator("input", "page"),
                "created_at": generator("input", "created_at", handler.date),
                "published_at": generator("input", "published_at", handler.date),
                "uploader_id": generator("uploader", "uploader_id"),
                "update_count": generator("database", "update_count", handler.increase),
                "updated_at": current
            }, options
        )[0].flat(2);
    }
 
    const inserted = videos.filter(
        ({ id }) => !exist_eid.includes(id)
    );

    const dataset = [];

    for (let index = 0; index < inserted.length; index++) {
        const video = inserted[index];

        dataset.push({
            "exterior": video.id,
            "title": video.title,
            "thumbnail": video.thumbnail,
            "duration": video.duration,
            "page_count": video.page,
            "created_at": video.created_at.toISOString().replaceAll(".000", ""),
            "published_at": video.published_at.toISOString().replaceAll(".000", ""),
            "uploader_id": mapping.related.uploader[video.uploader.id],
            "update_count": 1,
            "updated_at": current,
            "recorded_at": current
        });
    }

    if (dataset.length > 0) {
        const options = {
            "mode": "batch",
            "action": "execute",
            "return_field": field_list
        };
        
        response.insert = record.insert(
            "videos", dataset, options
        )[0].flat(2);
    }

    response.insert ??= [];
    response.update ??= [];

    const { update, insert } = response;

    return [ update, insert ].flat(1);
}