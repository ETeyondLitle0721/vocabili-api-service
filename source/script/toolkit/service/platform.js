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
 * 修改对象的字段名称和字段数值
 * 
 * @typedef {Object} Handler
 * @property {() => void} discard 删除字段
 * @property {(name: string) => void} rename 修改字段名称
 * 
 * @callback Replacer 字段数值替换器
 * @param {string} key 字段名称
 * @param {any} value 字段数值
 * @param {Handler} handler 字段操作控制器
 * 
 * @template {Object} U
 * @param {U} object 需要修改的对象
 * @param {Replacer} replacer 字段数值替换器
 * @returns {U} 修改过后的对象
 */
function modify(object, replacer) {
    object = structuredClone(object);

    const entries = Object.entries(object);

    for (let [ key, value ] of entries) {
        const result = replacer(key, value, {
            "rename": (name) => key = name,
            "discard": () => delete object[key]
        });

        if (result !== undefined) {
            value = result;
        }

        object[key] = value;
    }

    return object;
}

/**
 * 在数据库中数据库更新或者插入条目
 * 
 * @typedef {Object} Response
 * @property {number} id 视频内部标识符
 * @property {number} exterior 视频外部标识符
 * @property {number} update_count 更新次数
 * 
 * @callback Mapper 数据表表单字段数值映射器
 * @param {object[]} result 在数据库中查找外部识别码找的结果
 * @param {object[]} input 需要更新或者插入的条目
 * @returns {Object<string, Object<string, any>>} 数据表表单字段数值映射表
 * 
 * @typedef {Object} Options1
 * @property {string} table_name 操作的目标数据表名称
 * @property {Mapper} mapper 数据表表单字段数值映射器
 * 
 * @param {(object|object[])} items 需要更新或者插入的条目
 * @param {Options1} options 更新或者插入的时候的配置 
 * @param {Date} [instance=new Date()] 执行该操作时的 Date 实例化对象
 * @returns {Response[]} 更新或者插入的视频信息
 */
function upsert_item(items, options, instance = new Date()) {
    if (!Array.isArray(items)) {
        items = [ items ];
    }

    if (items.length > MIC) {
        const responses = [];

        const groups = split_group(items, MIC);

        for (let index = 0; index < groups.length; index++) {
            const current = groups[index];

            const result = upsert_item(
                current, options, instance
            );

            responses.push(result);
        }

        return responses.flat(1);
    }

    const record = operator.record();

    const eid_list = items.map(
        (item) => item.exterior
    );

    const condition = {
        "column": "exterior",
        "restrict": {
            "include": eid_list
        }
    };

    const { table_name } = options;

    const response = {}, field_list = [
        "id", "exterior", "update_count"
    ];

    response.select = record.select(
        table_name, condition, {
            "select": field_list
        }
    )[0].flat(2);

    /**
     * @description 已存在的项目外部标识符
     * 
     * @type {number[]}
     */
    const exist_eid = response.select.map(
        (record) => record.exterior
    );

    const current_datetime = instance.toISOString();

    const mapping = options.mapper(
        response.select, items
    );

    mapping.update_count = Object.fromEntries(
        response.select.map((record) => [
            record.exterior, record.update_count + 1
        ])
    );

    if (exist_eid.length > 0) {
        const condition = {
            "column": "exterior",
            "restrict": {
                "include": exist_eid
            }
        };

        const build = operator.statement().build;

        const generator = (field) => (options) => {
            return build.case.abstract.single(
                "exterior", mapping[field], options
            );
        };

        const options = {
            "action": "execute",
            "return_field": field_list
        };

        response.update = record.update(
            table_name, condition, {
                "update_count": generator(
                    "update_count"
                ),
                ...modify(mapping, (key) => {
                    return generator(key);
                })
            }, options
        )[0].flat(2);
    }

    const item_list = items.filter((item) => {
        const exterior = item.exterior;

        return !exist_eid.includes(exterior);
    });

    const dataset = [];

    for (let index = 0; index < item_list.length; index++) {
        const item = item_list[index];

        dataset.push({
            "updated_at": current_datetime,
            "recorded_at": current_datetime,
            ...item, "update_count": 1
        });
    }

    if (dataset.length > 0) {
        const options = {
            "mode": "batch",
            "action": "execute",
            "return_field": field_list
        };

        response.insert = record.insert(
            table_name, dataset, options
        )[0].flat(2);
    }

    response.insert ??= [];
    response.update ??= [];

    const { update, insert } = response;

    return [ update, insert ].flat(1);
}

/**
 * 生成数据表表单字段数值映射器
 * 
 * @param {Record<(string|number), Object>} mapping 生成映射器需要使用的映射表
 * @param {string[]} fields 需要映射的表单字段名称列表
 * @returns {Mapper} 生成的映射器
 */
function generate_mapper(mapping, fields) {
    return (records) => {
        const results = {};

        records.forEach((record) => {
            const id = record.exterior;
            const target = mapping[id];

            const entries = Object.entries(target);

            for (const [ key, value ] of entries) {
                if (!fields.includes(key)) {
                    continue;
                }

                results[key] ??= {};

                results[key][id] = value;
            }
        });

        return results;
    };
}

/**
 * 更新或者插入上传者信息到数据库中
 * 
 * @typedef {Object} Uploader
 * @property {number} id 上传者外部标识符
 * @property {string} name 上传者名称
 * @property {string} avatar 上传者头像
 * @property {Date} [snapshot_at] 数据抓取时间
 * 
 * @param {(Uploader|Uploader[])} uploaders 需要更新或者插入的上传者信息列表
 * @param {Date} [instance=new Date()] 执行操作的时候的时间
 * @returns {Response[]} 更新或者插入的上传者信息
 */
export function upsert_uploader(uploaders, instance = new Date()) {
    const dataset = [], mapping = {};

    for (let index = 0; index < uploaders.length; index++) {
        const { id, ...rest } = uploaders[index];

        rest.snapshot_at ??= instance;

        const data = {
            "username": rest.name,
            "avatar": rest.avatar, "exterior": id,
            "recorded_at": instance.toISOString(),
            "updated_at": rest.snapshot_at.toISOString(),
        };

        dataset.push(data), mapping[id] = data;
    }

    const field_list = [
        "avatar", "username", "updated_at", "recorded_at"
    ];

    const options = {
        "table_name": "uploaders",
        "mapper": generate_mapper(
            mapping, field_list
        )
    };

    return upsert_item(
        dataset, options, instance
    );
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
 * @property {Date} created_at 视频创建时间
 * @property {Date} published_at 视频更新时间
 * @property {Date} [snapshot_at] 数据抓取时间
 * 
 * @param {(Video|Video[])} videos 需要更新或者插入的视频信息列表
 * @param {Date} [instance=new Date()] 执行操作的时候的时间
 * @returns {Response[]} 更新或者插入的视频信息
 */
export function upsert_video(videos, instance = new Date()) {
    const format = (instance) => {
        const text = instance.toISOString();
        
        return text.replaceAll(".000", "");
    };

    const dataset = [], mapping = {};

    const vid_to_uid = new Map(
        upsert_uploader(videos.map(video =>
            Object.assign(video.uploader, {
                "snapshot_at": video.snapshot_at || instance
            })
        )).map((result, index) => {
            const video = videos[index];

            return [ video.id, result.id ];
        })
    );

    for (let index = 0; index < videos.length; index++) {
        const { id, ...rest } = videos[index];

        rest.recorded_at ??= instance;

        const data = {
            "title": rest.title,
            "uploader_id": vid_to_uid.get(id),
            "thumbnail": rest.thumbnail,
            "duration": rest.duration,
            "page_count": rest.page,
            "created_at": format(rest.created_at),
            "published_at": format(rest.published_at),
            "recorded_at": format(rest.recorded_at),
            "exterior": id
        };

        dataset.push(data), mapping[id] = data;
    }

    const field_list = [
        "uploader_id", "recorded_at",
        "title", "duration", "page",
        "page_count", "thumbnail",
        "created_at", "published_at",
    ];

    const options = {
        "table_name": "videos",
        "mapper": generate_mapper(
            mapping, field_list
        )
    };

    return upsert_item(
        dataset, options, instance
    );
}

/**
 * 分配一个批次标识符
 * 
 * @typedef {Object} Options2
 * @property {number} count 批次视频数量
 * @property {Date} start 批次开始时间
 * @property {Date} record 批次记录时间
 * @property {Date} end 批次结束时间
 * 
 * @param {Options2} options 本批次的配置
 * @returns {number} 分配到的标识符
 */
function assgin_batch_id(options = {}) {
    options.start ??= new Date();
    options.end ??= new Date();
    options.record ??= new Date();

    options.count ??= 0;

    const record = operator.record();

    const ended_at = options.end.toISOString();
    const started_at = options.start.toISOString();
    const recorded_at = options.record.toISOString();

    const dataset = [{
        "video_count": options.count,
        "ended_at": ended_at,
        "started_at": started_at,
        "recorded_at": recorded_at
    }];

    const result = record.insert(
        "batches", dataset, {
            "mode": "batch",
            "action": "execute",
            "return_field": [
                "id"
            ]
        }
    )[0].flat(2);

    return result[0].id;
}

/**
 * 在数据库中插入一个批次的快照信息
 * 
 * @typedef {Object} VideoCounter
 * @property {number} coin 投币数量
 * @property {number} view 观看次数
 * @property {number} like 点赞次数
 * @property {number} favorite 收藏次数
 * 
 * @typedef {Object} SnapshotData
 * @property {Video} video 视频信息
 * @property {VideoCounter} counter 视频统计信息
 * @property {Date} snapshot_at 数据抓取时间
 * 
 * @typedef {Object} Snapshot
 * @property {object} date 快照抓取的时间范围
 * @property {Date} date.start 数据开始抓取时间
 * @property {Date} date.end 数据结束抓取时间
 * @property {SnapshotData[]} data 快照数据
 * 
 * @param {Snapshot} snapshot 需要插入的数据
 * @returns {void}
 */
export function insert_snpahsots(snapshot, instance = new Date()) {
    const bath_id = assgin_batch_id({
        "count": snapshot.data.length,
        "end": snapshot.date.end,
        "record": instance,
        "start": snapshot.date.start
    });

    const videos_list = snapshot.data.map((current) =>
        Object.assign(current.video, { "recorded_at": 
            current.snapshot_at || instance
        })
    );

    const videos = upsert_video(videos_list, instance);

    const exterior_to_vid = new Map(
        videos.map((current) => [
            current.exterior, current.id
        ])
    );

    const dataset = [];

    for (let index = 0; index < snapshot.data.length; index++) {
        const { video, counter, ...rest } = snapshot.data[index];

        const vid = exterior_to_vid.get(video.id);

        dataset.push({
            "batch_id": bath_id,
            "video_id": vid,
            "count_coin": counter.coin,
            "count_view": counter.view,
            "count_like": counter.like,
            "count_favorite": counter.favorite,
            "recorded_at": instance.toISOString(),
            "snapshot_at": (rest.snapshot_at || instance).toISOString(),
        });
    }

    const groups = split_group(dataset, MIC);

    for (let index = 0; index < groups.length; index++) {
        operator.insert_record(
            "snapshots", groups[index], {
                "mode": "batch"
            }
        );
    }
}