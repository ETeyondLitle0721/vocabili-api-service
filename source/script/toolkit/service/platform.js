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
                ...modify(mapping, (key) => {
                    return generator(key);
                }),
                "updated_at": current_datetime,
                "update_count": generator("update_count"),
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
            ...item, "update_count": 1,
            "updated_at": current_datetime,
            "recorded_at": current_datetime
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
 * 
 * @param {(Uploader|Uploader[])} uploaders 需要更新或者插入的上传者信息列表
 * @param {Date} [instance=new Date()] 执行操作的时候的时间
 * @returns {Response[]} 更新或者插入的上传者信息
 */
function upsert_uploader(uploaders, instance = new Date()) {
    const dataset = [], mapping = {};

    for (let index = 0; index < uploaders.length; index++) {
        const { id, name, avatar } = uploaders[index];

        const data = {
            "avatar": avatar,
            "exterior": id,
            "username": name,
        };

        dataset.push(data);
        mapping[id] = data;
    }

    const field_list = [
        "avatar", "username"
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
 * 
 * @param {(Video|Video[])} videos 需要更新或者插入的视频信息列表
 * @param {Date} [instance=new Date()] 执行操作的时候的时间
 * @returns {Response[]} 更新或者插入的视频信息
 */
function upsert_video(videos, instance = new Date()) {
    const format = (instance) => {
        const text = instance.toISOString();
        
        return text.replaceAll(".000", "");
    };

    const dataset = [], mapping = {};

    const vid_to_uid = new Map(
        upsert_uploader(videos.map(
            video => video.uploader
        )).map((result, index) => {
            const video = videos[index];

            return [ video.id, result.id ];
        })
    );

    for (let index = 0; index < videos.length; index++) {
        const { id, ...rest } = videos[index];

        const data = {
            "title": rest.title,
            "uploader_id": vid_to_uid.get(id),
            "thumbnail": rest.thumbnail,
            "duration": rest.duration,
            "page_count": rest.page,
            "created_at": format(rest.created_at),
            "published_at": format(rest.published_at),
            "exterior": id
        };

        dataset.push(data);
        mapping[id] = data;
    }

    const field_list = [
        "uploader_id",
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
 * 
 * @param {Options2} options 本批次的配置
 * @returns {number} 分配到的标识符
 */
function assgin_batch_id(options = {}) {
    options.start ??= new Date();
    options.record ??= new Date();

    options.count ??= 0;

    const record = operator.record();

    const started_at = options.start.toISOString();
    const recorded_at = options.record.toISOString();

    const dataset = [{
        "video_count": options.count,
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
 * 补齐批次基本信息
 * 
 * @typedef {Object} Options3
 * @property {Date} end 批次结束时间
 * 
 * @param {number} id 需要更新的批次标识符
 * @param {Options3} options 批次的配置信息
 * @returns {void}
 */
function patch_batch_info(id, options) {
    options.end ??= new Date();

    const record = operator.record();

    const end = options.end;

    const condition = {
        "column": "id",
        "restrict": {
            "include": [ id ]
        }
    };

    const result = record.update(
        "batches", condition, {
            "ended_at": end.toISOString()
        }
    )[0].flat(2);

    return result;
}