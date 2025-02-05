import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import DatabaseOperator from "../../depend/operator/database.js";
import { text_transformer as capitalize, get_type } from "../../depend/core.js";

const root = path.resolve(".");
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {import("../../depend/operator/database.js").GeneralObject} GeneralObject
 */

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    ),
    "current": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/default.json"
        ), "UTF-8")
    )
};

const field = "default";
const database = {
    /** @type {string} */
    "filepath": config.global.database.filepath[field]
};

const operator = new DatabaseOperator(new SQLite3(database.filepath, {
    "timeout": 1000,
    "readonly": false
}));

/**
 * 获取排行榜元信息
 * 
 * @param {string} target 排行榜识别码
 * @returns 获取到的元信息
 */
export function get_board_metadata_info_by_board_id(target) {
    return config.current.metadata.board[target];
}

/**
 * 通过识别码获取相关信息
 * 
 * @param {("song"|"uploader"|"vocalist"|"producer"|"platform"|"synthesizer")[]} type 识别码的来源类型列表
 * @param {string[]} list 需要获取的识别码列表
 * @returns 获取到的目标信息
 */
export function get_target_info_by_id(type, list) {
    const table_list = get_type(type).second === "array" ? type.map(item => {
        return capitalize(item) + "_Table";
    }) : [ capitalize(type) + "_Table" ];

    return operator.select_item(table_list, {
        "where": {
            "column": "id",
            "operator": "within",
            "value": list
        }
    });
}

/**
 * 通过目标识别码获取所有的标记信息
 * 
 * @param {string[]} list 需要获取标记信息的目标识别码列表
 * @returns 获取到的目标标记信息
 */
export function get_mark_info_by_target_id(list) {
    return operator.select_item("Mark_Table", {
        "where": {
            "column": "target",
            "operator": "within",
            "value": list
        }
    });
}

/**
 * 获取歌曲历史排名数据
 * 
 * @param {object} config 配置信息
 * @param {string} config.board 目标榜单
 * @param {number} config.count 每页数量
 * @param {number} config.index 页索引
 * @param {number} config.issue 期数列表
 * @param {string[]} config.target 目标列表
 * @returns 获取到的数据
 */
export function get_rank_by_song_id(config) {
    const options = Object.assign({
        "issue": [], "board": [], "count": 15, "index": 1
    }, config);

    const select_options = {
        "where": [
            {
                "column": "target",
                "operator": "within",
                "value": options.target
            }
        ]
    };

    if (options.board.length > 0) {
        select_options.where.push({
            "column": "board",
            "operator": "within",
            "value": options.board
        });
    }

    if (options.issue.length > 0) {
        select_options.where.push({
            "column": "issue",
            "operator": "within",
            "value": options.issue
        });
    }

    if (options.count > 0) {
        select_options.control = {
            "result": {
                "limit": options.count,
                "offset": options.index - 1
            }
        };
    }

    return operator.select_item(
        "Rank_Table", select_options
    );
}

/**
 * 获取排行榜信息
 * 
 * @param {object} config 传入配置
 * @param {string} config.board 目标排行榜名称
 * @param {number} config.count 每页数量
 * @param {number} config.index 页索引
 * @param {number} config.issue 期数
 * @returns 查询结果
 */
export function get_board_song_list(config) {
    const options = Object.assign({
        "count": 50, "index": 1
    }, config);

    return operator.select_item("Rank_Table", {
        "where": [
            {
                "column": "board",
                "operator": "equal",
                "value": options.board
            },
            {
                "column": "issue",
                "operator": "equal",
                "value": options.issue
            }
        ],
        "control": {
            "result": {
                "limit": options.count,
                "offset": options.index - 1
            }
        }
    });
}

/**
 * 获取曲目识别码对应的历史数据
 * 
 * @param {object} config 传入的配置
 * @param {number} config.count 一页展示的项目数量
 * @param {number} config.index 当前的页索引
 * @param {string} config.target 需要查询的目标
 * @returns 查询结果
 */
export function get_song_history_info(config) {
    const options = Object.assign({
        "count": 50, "index": 1
    }, config);

    return operator.select_item("Snapshot_Table", {
        "where": {
            "column": "target",
            "operator": "equal",
            "value": options.target
        },
        "control": {
            "result": {
                "limit": options.count,
                "offset": options.index - 1
            }
        }
    });
}