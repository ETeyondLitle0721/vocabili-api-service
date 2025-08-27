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

/**
 * 构造在冲突时修改构建结果的审查函数
 * 
 * @typedef {{ sentence: string }[]} ReviewerList
 * 
 * @param {string} conflict 描述语句
 * @returns {((list: ReviewerList) => ReviewerList)} 审查函数
 */
function on_conflict(conflict) {
    const _reviewer = (result) => {
        return result.map((current) => {
            const { sentence } = current;

            current.sentence = sentence.replace(
                "RETURNING", conflict + " RETURNING"
            );

            return current;
        });
    };

    return _reviewer;
}

const extract = (field) => {
    return (item) => item[field];
};

const MIC = 8192; // 单次插入标识符最大数量

/**
 * 为外部的标识符分配一个数据库内部特有的标识符
 * 
 * @param {(string|string[])} id_list 需要分配内部标识符的外部标识符列表
 * @param {string} table_name 插入操作所属的数据表
 * @param {Date} [instance=new Date()] 插入操作发生时的时间实例化对象
 * @returns {Record<string, number>} 插入后的数据表内部的识别码索引对象
 */
function assign_internal_id(id_list, table_name, instance = new Date()) {
    const result = {};

    if (!Array.isArray(id_list)) {
        id_list = [ id_list ];
    }

    if (id_list.length > MIC) {
        const results = [], groups = split_group(id_list, MIC);

        const get_id_mapping = assign_internal_id;

        for (let index = 0; index < groups.length; index++) {
            const current = groups[index];

            results.push(get_id_mapping(
                current, table_name, instance
            ));
        }

        return Object.assign(...results);
    }

    const dataset = [];

    for (let index = 0; index < id_list.length; index++) {
        dataset.push({
            "exterior": id_list[index],
            "recorded_at": instance.toISOString()
        });
    }

    const record = operator.record();

    const response = {};

    const condition = {
        "column": "exterior",
        "restrict": {
            "include": dataset.map(
                extract("exterior")
            )
        }
    };

    const field_list = [ "id", "exterior" ];

    response.select = record.select(
        table_name, condition, {
            "select": field_list
        }
    )[0].flat(2);

    const exists_vids = response.select.map(
        (record) => extract("exterior")(record)
    );

    dataset.insert = dataset.filter((item) => {
        const exterior = extract("exterior")(item);

        return !exists_vids.includes(exterior);
    });

    if (dataset.insert.length > 0) {
        const options = {
            "mode": "batch",
            "action": "execute",
            "flag": [ "if-exists-ignore" ],
            "return_field": field_list
        };

        const data_list = dataset.insert;

        response.insert = record.insert(
            table_name, data_list, options
        )[0].flat(2);
    }

    const item_list = Object.values(response).flat(2);

    for (let index = 0; index < item_list.length; index++) {
        const current = item_list[index];

        result[current.exterior] = current.id;
    }

    return result;
}

/**
 * 为外部的视频标识符分配一个数据库内部特有的标识符
 * 
 * @param {(string|string[])} id_list 需要分配内部标识符的第二代视频识别码列表
 * @param {Date} [instance=new Date()] 插入操作发生时的时间实例化对象
 * @returns {Record<string, number>} 插入后的数据表内部的识别码索引对象
 */
function assign_internal_vid(id_list, instance = new Date()) {
    const table_name = "video_ids";
    
    return assign_internal_id(
        id_list, table_name, instance
    );
}

/**
 * 为外部的视频上传者标识符分配一个数据库内部特有的标识符
 * 
 * @param {(number|number[])} id_list 需要分配内部标识符的视频上传者识别码列表
 * @param {Date} [instance=new Date()] 插入操作发生时的时间实例化对象
 * @returns {Record<string, number>} 插入后的数据表内部的识别码索引对象
 */
function assign_internal_uid(id_list, instance = new Date()) {
    const table_name = "uploader_ids";

    return assign_internal_id(
        id_list, table_name, instance
    );
}

/**
 * 分配外部图床资源链接一个内部资源字符串
 * 
 * @param {(string|string[])} link_list 需要分配内部标识符的图床资源链接列表
 * @param {Date} [instance=new Date()] 插入操作发生时的时间实例化对象
 * @returns {string} 插入后的数据表内部的识别码索引对象
 */
function assign_internal_rid(link_list, instance = new Date()) {
    const table_name = "resource_ids";

    return assign_internal_id(
        link_list, table_name, instance
    );
}

/**
 * 批量插入或更新视频上传者的信息
 * 
 * @typedef {Object} UploaderInfo
 * @property {number} id 上传者识别码
 * @property {string} name 上传者名称
 * @property {string} avatar 上传者头像
 * 
 * @param {(UploaderInfo|UploaderInfo[])} uploader_infos 需要插入或更新的上传者信息
 * @param {Date} [instance=new Date()] 插入操作发生时的时间实例化对象
 * @returns 操作过程中的各种结果
 */
function upsert_uploader_infos(uploader_infos, instance = new Date()) {
    if (!Array.isArray(uploader_infos)) {
        uploader_infos = [ uploader_infos ];
    }

    const uids = uploader_infos.map(
        (record) => extract("id")(record)
    );
    const avatars = uploader_infos.map(
        (record) => extract("avatar")(record)
    );

    const mapping = {
        "avatar": assign_internal_rid(avatars),
        "uploader": assign_internal_uid(uids),
        "dataset": {}
    };

    const dataset = [];

    for (let index = 0; index < uploader_infos.length; index++) {
        const { id, avatar, name } = uploader_infos[index];

        const uid = mapping.uploader[id];

        const data = {
            "uid": uid, "username": name,
            "avatar": mapping.avatar[avatar],
            "updated_at": instance.toISOString(),
            "recorded_at": instance.toISOString()
        };

        mapping.dataset[uid] = data;

        dataset.push(data);
    }

    const response = {};

    const record = operator.record();

    const condition = {
        "column": "uid",
        "restrict": {
            "include": dataset.map(
                extract("uid")
            )
        }
    };

    response.select = record.select(
        "uploader_info", condition, {
            "select": [ "uid", "update_count" ]
        }
    )[0].flat(2);

    const table_name = "uploader_info";

    if (response.select.length > 0) {
        const uid_list = response.select.map(
            (record) => extract("uid")(record)
        );

        const where = {
            "column": "id", 
            "restrict": {
                "include": uid_list
            }
        };

        const statement = operator.statement();

        const builder = statement.build.case.abstract.single;

        const genreator = (field, handler) => {
            handler ??= (item) => item;

            return (options) => {
                const entries = Object.entries(mapping.dataset);

                return builder("uid", Object.fromEntries(
                    entries.map(([ uid, data ]) => {
                        return [ uid, handler(data[field]) ];
                    })
                ), options);
            };
        };

        const updated = {
            "avatar": genreator("avatar"),
            "username": genreator("username"),
            "update_count": (options) => {
                return builder("uid", Object.fromEntries(
                    response.select.map((record) => {
                        const { uid, update_count } = record;

                        return [ uid, update_count + 1 ];
                    })
                ), options);
            },
            "updated_at": instance.toISOString()
        };

        console

        response.updated = record.update(
            table_name, where, updated, {}
        );
    }

    const exists_uids = response.select.map(
        (record) => extract("uid")(record)
    );

    dataset.insert = dataset.filter((item) => {
        const uid = extract("uid")(item);
        
        return !exists_uids.includes(uid);
    });

    if (dataset.insert.length > 0) {
        const data_list = dataset.insert;

        response.insert = record.insert(
            table_name, data_list, {}
        )[0].flat(2);
    }

    return response;
}

upsert_uploader_infos([
    { "id": 7348164816823, "name": "kadhiheufhquiaxc", "avatar": "adfiviyfgaxbchscb scuiasc" }
])