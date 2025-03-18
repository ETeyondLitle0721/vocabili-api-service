import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import DatabaseOperator from "../../../depend/operator/database.js";
import {
    text_transformer as cap,
    unique_array, classification
} from "../../../depend/core.js";

const root = path.resolve(".");
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {import("../../../depend/operator/database.js").GeneralObject} GeneralObject
 */

const filepath = {
    "global": path.resolve(
        root, "./config.json"
    ),
    "define": path.resolve(
        __dirname, "../define/default.json"
    )
};

const config = {
    "global": JSON.parse(
        fs.readFileSync(
            filepath.global, "UTF-8"
        )
    ),
    "current": JSON.parse(
        fs.readFileSync(
            filepath.define, "UTF-8"
        )
    )
};

/**
 * 函数防抖
 * 
 * @param {Function} fn 需要防抖的方法
 * @param {number} delay 延时时间（毫秒）
 * @returns {Function} 防抖过后的函数
 */
function debounce(fn, delay) {
    let timer = null;

    return function (...args) {
        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

const updater = debounce(() => {
    console.log(`监听到 ${filepath.define} 文件发生变化，正在尝试更新.....`);

    try {
        config.current = JSON.parse(fs.readFileSync(
            filepath.define, "UTF-8"
        ));

        console.log("目标文件更新完毕，当前的时间为 " + get_iso_time_text());
    } catch (error) {
        console.log("目标文件更新失败，原始错误对象为:", error);
    }

    instance.pragma("wal_checkpoint(FULL)");
}, 100);

const field = "default";
const database = {
    /** @type {string} */
    "path": config.global.database[field].path
};

const instance = new SQLite3(database.path, {
    "timeout": 1000,
    "readonly": false
});
const operator = new DatabaseOperator(instance);

fs.watch(filepath.define, updater);

// 依赖函数

/**
 * 获取当前的 ISO 8601 毫秒级时间字符串
 * 
 * @param {Date} instance 需要转换的 Date 实例
 * @param {(text: string) => string} handler 结构处理器
 * @returns {string} 转换出来的结果
 */
export function get_iso_time_text(instance = new Date(), handler = text => text) {
    return handler(instance.toISOString());
}

/**
 * 计算用于分页查询的 LIMIT 参数和 OFFST 参数
 * 
 * @param {number} count 单页展示项目数量
 * @param {number} index 当前页的页索引
 * @returns 计算出来的参数
 */
export function pagination(count, index) {
    return {
        "limit": count, "offset": count * (index - 1)
    };
}

// 低级 API

/**
 * 获取排行榜元信息
 * 
 * @typedef BoardItem
 * @property {number} issue 期刊编号
 * @property {string} date 发刊日期
 * @property {string} name 刊目名称
 * @property {Object<string, number>} part 子刊列表
 * @property {number} total 总项目数量
 * 
 * @typedef BoardMetadata
 * @property {string} name 榜单名称
 * @property {BoardItem[]} catalog 历史刊目数据
 * 
 * @param {string} target 排行榜识别码
 * @returns {BoardMetadata} 获取到的元信息
 */
export function get_board_metadata_by_id(target) {
    return config.current.metadata.board[target];
}

/**
 * 通过识别码获取相关信息
 * 
 * @param {("song"|"uploader"|"vocalist"|"producer"|"platform"|"synthesizer")[]} type 识别码的来源类型列表
 * @param {string[]} list 需要获取的识别码列表
 * @returns 获取到的目标信息
 */
export function get_target_by_id(type, list) {
    if (!Array.isArray(type)) {
        type = [ type ];
    }

    return operator.select_item(type.map(
        item => cap(item) + "_Table"
    ), {
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
export function get_mark_by_id(list) {
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
 * @param {string} config.part 目标子刊
 * @param {("newset"|"oldest")} config.sort 排序方式
 * @param {string} config.board 目标榜单
 * @param {number} config.count 每页数量
 * @param {number} config.index 页索引
 * @param {number[]} config.issue 期数列表
 * @param {string[]} config.target 目标列表
 * @returns 获取到的数据
 */
export function get_rank_by_song_id(config) {
    if (config.issue) {
        if (!Array.isArray(config.issue)) {
            config.issue = [ config.issue ];
        }
    }

    const options = {
        "where": [
            {
                "column": "target",
                "operator": "within",
                "value": config.target
            },
            {
                "column": "part",
                "operator": "equal",
                "value": config.part
            }
        ]
    };

    if (config.board.length > 0) {
        options.where.push({
            "column": "board",
            "operator": "equal",
            "value": config.board
        });
    }

    if (config.issue.length > 0) {
        options.where.push({
            "column": "issue",
            "operator": "within",
            "value": config.issue
        });
    }

    options.control = {};

    if (config.count > 0) {
        options.control.result = pagination(
            config.count, config.index
        );
    }

    options.control.order = {
        "column": "issue",
        "method": {
            "newest": "descending",
            "oldest": "ascending"
        } [ config.sort ]
    };

    const result = operator.select_item("Rank_Table", options);

    return {
        "where": options.where,
        "result": result
    };
}

/**
 * 获取排行榜指定子刊信息
 * 
 * @param {object} config 传入配置
 * @param {string} config.board 目标排行榜名称
 * @param {number} config.count 每页数量
 * @param {number} config.index 页索引
 * @param {number} config.issue 期数
 * @param {string} config.part 子刊名称
 * @returns 查询结果
 */
export function get_board_entry_song_list(config) {
    const options = {
        "where": [], "control": {}
    };

    options.where.push({
        "column": "board",
        "operator": "equal",
        "value": config.board
    });

    options.where.push({
        "column": "part",
        "operator": "equal",
        "value": config.part
    });

    options.where.push({
        "column": "issue",
        "operator": "equal",
        "value": config.issue
    });

    options.control.result = pagination(
        config.count, config.index
    );

    return operator.select_item(
        "Rank_Table", options
    );
}

/**
 * 获取 get_song_info_by_id 方法所需的依赖
 * 
 * @returns 获取到的结果
 */
function get_depend_song_info() {
    /**
     * 解析歌曲信息
     * 
     * @param {Object} song 歌曲原始数据对象
     * @param {Object} mark 标记数据对象
     * @param {Object} target 目标数据集合
     * @param {Object} uploader 上传者信息集合
     * @returns {Object} 包含元数据和平台信息的对象
     */
    const parse_song = (song, mark, target, uploader) => {
        const song_mark = mark[song.id];
    
        const metadata = {
            "id": song.id,
            "name": song.name,
            "type": song.type,
            "target": {
                "producer": [],
                "vocalist": [],
                "synthesizer": []
            }
        };

        for (const [ field, list ] of Object.entries(song_mark)) {
            let pusher;

            if (field === "vocalist") {
                pusher = id => metadata.target.vocalist.push({
                    "id": id, "name": target[id].name,
                    "color": target[id].color
                });
            }

            if ([ "producer", "synthesizer" ].includes(field)) {
                pusher = id => metadata.target[field].push({
                    "id": id, "name": target[id].name
                });
            }

            if (!pusher) continue;

            list.forEach(
                id => pusher(id) 
            );
        }
            
        const platform = [];

        if (song_mark.platform) {
            song_mark.platform.forEach(id => {
                platform.push(parse_platform(
                    id, target, uploader
                ));
            });
        }
    
        return { metadata, platform };
    };

    /**
     * 解析平台信息
     * @param {string} id 平台ID
     * 
     * @param {Object} target 目标数据集合
     * @param {Object} uploader 上传者信息集合
     * @returns {Object} 平台详细信息对象
     */
    const parse_platform = (id, target, uploader) => {
        const info = target[id];
    
        const result = {
            "id": id, "page": info.page,
            "link": info.link.replace("BB://V/", "https://b23.tv/"),
            "publish": info.published_at, "title": info.title, "uploader": [],
            "duration": info.duration, "copyright": info.copyright,
            "thumbnail": info.thumbnail ? info.thumbnail.replace(
                "BB://I/", "https://i0.hdslb.com/bfs/archive/"
            ) : null
        };

        if (uploader[id]) {
            uploader[id].forEach(
                item => result.uploader.push({
                    "id": item.value, "name": target[item.value].name
                })
            );
        }
    
        return result;
    };
    
    /**
     * 根据歌曲ID获取标记信息
     * 
     * @param {string[]} ids 歌曲ID数组
     * @returns {Object} 按分类组织的标记信息对象
     */
    const get_mark_by_song_ids = ids => Object.fromEntries(Object.entries(
        classification(
            get_mark_by_id(ids),
            value => value.target
        )
    ).map(([key, value]) => ([
        key, Object.fromEntries(Object.entries(
            classification(value, value => value.type)
        ).map(([key, value]) => ([
            key, unique_array(value.map(
                item => item.value
            ))
        ])))
    ])));
    
    /**
     * 根据标记信息获取目标数据
     * 
     * @param {Object} mark_info 标记信息对象
     * @returns {Object} 目标数据映射表（ID到对象的映射）
     */
    const get_target_by_mark_info = mark_info => Object.fromEntries(
        get_target_by_id(
            [ "producer", "vocalist", "synthesizer", "platform" ],
            Object.values(mark_info).flat().map(
                item => Object.values(item)
            ).flat(2)
        ).map(item => item.response).flat().map(
            item => ([ item.id, item ])
        )
    );
    
    /**
     * 根据标记信息获取上传者信息
     * 
     * @param {Object} mark_info 标记信息对象
     * @returns {Object} 按分类组织的上传者信息
     */
    const get_uploader_info_by_mark_info = mark_info => classification(
        get_mark_by_id(
            Object.values(mark_info).map(
                item => Object.values(item)
            ).flat(2).filter(
                item => item.startsWith("Platform:")
            )
        ), value => value.target
    );

    return {
        parse_song, parse_platform,
        get_mark_by_song_ids,
        get_target_by_mark_info,
        get_uploader_info_by_mark_info
    };
}

/**
 * 获取 get_board_entry_info 方法所需的依赖
 * 
 * @returns 获取到的结果
 */
function get_depend_board_entry_info() {
    /**
     * 解析歌曲信息（排行榜条目用）
     * 
     * @param {Object} target 目标数据集合
     * @param {Object} song 歌曲原始数据对象
     * @returns {Object} 合并后的歌曲信息对象
     */
    const parse_song = (target, song) => Object.assign(
        parse_song_rank_info(song), {
            "target": parse_target(
                target[song.target], song.platform
            )
        }
    );

    /**
     * 解析目标平台信息
     * 
     * @param {Object} target 目标数据对象
     * @param {string} platform 平台ID
     * @returns {Object} 修改后的目标数据对象
     */
    const parse_target = (target, platform) => {
        for (const [ field, value ] of Object.entries(target)) {
            if (field === "platform") {
                target[field] = value.find(
                    item => item.id === platform
                ) ?? {};
            }
        }

        return target;
    };

    return {
        parse_song, parse_target
    };
}

// 高级 API 

/**
 * 从数据库中现有的数据中获取曲目信息（包含标记信息）
 * 
 * @param {string[]} ids 需要获取信息的曲目的识别码列表
 * @returns 获取到的曲目数据
 */
export function get_song_info_by_id(ids = []) {
    const depend = get_depend_song_info();

    const song = get_target_by_id("song", ids);
    const mark = depend.get_mark_by_song_ids(song.map(
        item => item.id
    ));
    const target = depend.get_target_by_mark_info(mark);
    const uploader = depend.get_uploader_info_by_mark_info(mark);

    get_target_by_id(
        "uploader", Object.values(uploader).flat().map(
            item => item.value
        )
    ).forEach(
        temp => target[temp.id] = temp
    );

    const map = Object.fromEntries(song.map(
        item => ([ item.id, item ])
    ));

    return ids.map(id => depend.parse_song(
        map[id], mark, target, uploader
    )); // 保证返回顺序为请求顺序
}

/**
 * 解析曲目上榜条目信息
 * 
 * @param {object} song 需要解析的信息
 * @returns 解析出来的信息
 */
export function parse_song_rank_info(song) {
    return {
        "rank": {
            "view": song.view_rank,
            "like": song.like_rank,
            "coin": song.coin_rank,
            "board": song.rank,
            "favorite": song.favorite_rank
        },
        "point": song.point,
        "count": song.count ?? -1,
        "change": {
            "view": song.view_change,
            "like": song.like_change,
            "coin": song.coin_change,
            "favorite": song.favorite_change
        }
    };
}

/**
 * 获取排行榜数据
 * 
 * @param {number} issue 需要获取数据的期数
 * @param {string} board 需要获取的排行榜
 * @param {number} count 要获取多少个
 * @param {number} index 页索引
 * @param {string} part 需要获取的目标的子刊名称
 * @returns 获取到的排行榜信息
 */
export function get_board_entry_info(issue, board = "vocaoid-weekly", count = 50, index = 1, part) {
    const depend = get_depend_board_entry_info();
    const metadata = { "board": get_board_metadata_by_id(board) };
    const list = get_board_entry_song_list({ issue, count, index, board, part });

    metadata.issue = metadata.board.catalog.find(
        item => item.issue === issue
    );

    const song_ids = list.map(item => item.target);

    const target = Object.fromEntries(
        get_song_info_by_id(song_ids).map(item => ([
            item.metadata.id, item
        ]))
    );
    
    const result = {
        "board": list.map(
            song => depend.parse_song(
                target, song
            )
        ),
        "metadata": {
            "id": board, issue,
            "name": metadata.name,
            "date": metadata.issue.date,
            "part": list[0].part,
            "count": metadata.issue.part[list[0].part]
        }
    };

    const last_rank = get_rank_by_song_id({
        board, part,
        "issue": issue - 1, // 获取上一期的期数
        "target": song_ids
    }).result;

    for (let index = 0; index < last_rank.length; index++) {
        const current = last_rank[index];
        
        result.board[song_ids.indexOf(current.target)].last = {
            "rank": current.rank,
            "point": current.point
        };
    }

    return result;
}

/**
 * 获取最新的排行榜
 * 
 * @param {string} board 需要获取的排行榜
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @param {string} part 需要获取的目标的子刊名称
 * @returns 获取到的排行榜信息
 */
export function get_latest_board_entry_info(board = "vocaoid-weekly", count = 50, index = 1, part) {
    const metadata = get_board_metadata_by_id(board);

    return get_board_entry_info(
        metadata.catalog.at(-1).issue,
        board, count, index, part
    );
}

/**
 * 获取曲目历史统计量信息
 * 
 * @param {string} target 需要曲目
 * @param {("newest"|"oldest")} sort 排序方法
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的排行榜信息
 */
export function get_platform_count_history_by_id(target, sort, count = 50, index = 1) {
    const where = {
        "column": "target",
        "operator": "equal",
        "value": target
    };

    const result = operator.select_item(
        "Snapshot_Table", {
            "where": where,
            "control": {
                "order": {
                    "column": "snapshot_at",
                    "method": {
                        "newest": "descending",
                        "oldest": "ascending"
                    } [ sort ]
                },
                "result": pagination(
                    count, index
                )
            }
        }
    );

    return {
        "total": operator.count_item(
            "Snapshot_Table", { where }
        )[0]["COUNT(*)"],
        "result": result.map(item => ({
            "date": item.snapshot_at, "count": {
                "view": item.view, "like": item.like,
                "coin": item.coin, "favorite": item.favorite
            }
        }))
    };
}

/**
 * 获取曲目历史排名信息
 * 
 * @param {string} target 目标曲目
 * @param {number[]} issue 需要获取的期数列表
 * @param {string} board 排名榜单
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的排行榜信息
 */
export function get_song_rank_history_info_by_id(target, issue, sort, board, part, count = 50, index = 1) {
    const info = get_rank_by_song_id({
        count, index, target, issue, board, part, sort
    });

    const result = info.result.map(item => Object.assign(
        parse_song_rank_info(item), {
            "issue": item.issue, "board": item.board
        })
    );

    return {
        "total": operator.count_item(
            "Rank_Table", {
                "where": info.where
            }
        )[0]["COUNT(*)"],
        "result": result
    };
}

/**
 * 获取目标列表
 * 
 * @param {("song"|"board"|"uploader"|"vocalist"|"producer"|"synthesizer")} type 需要获取的目标类型
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的目标列表
 */
export function get_target_list_by_type(type, count = 50, index = 1) {
    if (type === "board") {
        const board = config.current.metadata.board;

        return Object.keys(board).filter((_, board_index) => 
            count === -1 || (
                board_index + 1 > count * (index - 1) &&
                board_index + 1 <= count * index
            )
        ).map(item => {
            const metadata = board[item];

            return {
                "id": item, "name": metadata.name,
                "issue": metadata.catalog.length
            };
        });
    }

    const table_name = cap(type) + "_Table";

    const where = type === "song" ? {
        "column": "type",
        "operator": "<>",
        "value": "Unmarked"
    } : {};

    const result = operator.select_item(table_name, {
        where, "control": {
            "result": pagination(count, index)
        }
    });

    return {
        "total": operator.count_item(
            table_name, { where }
        )[0]["COUNT(*)"],
        "result": ((type, result) => {
            if (type === "song") return get_song_info_by_id(
                result.map(item => item.id)
            );
            
            if (type === "vocalist") return result.map(item => ({
                "id": item.id,
                "name": item.name,
                "color": item.color
            }));
            
            return result.map(item => ({
                "id": item.id, "name": item.name
            }));
        })(type, result)
    };
}

/**
 * 获取曲目列表（通过关联信息）
 * 
 * @param {("uploader"|"vocalist"|"producer"|"synthesizer")} type 关联类型
 * @param {string} target 关联信息对应的识别码
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的曲目列表
 */
export function get_song_list_by_mark(type, target, count = 50, index = 1) {
    const where = [
        {
            "column": "value",
            "operator": "equal",
            "value": target
        },
        {
            "column": "type",
            "operator": "equal",
            "value": type
        }
    ];

    const result = operator.select_item("Mark_Table", {
        where, "control": {
            "result": pagination(count, index)
        }
    });

    const mapping = type === "uploader" ? Object.fromEntries(
        operator.select_item("Mark_Table", {
            "where": [
                {
                    "column": "type",
                    "operator": "equal",
                    "value": "platform"
                },
                {
                    "column": "value",
                    "operator": "within",
                    "value": result.map(
                        item => item.target
                    )
                }
            ]
        }).map(item => ([
            item.value, item.target
        ]))
    ) : {};

    return {
        "total": operator.count_item(
            "Mark_Table", { where }
        )[0]["COUNT(*)"],
        "result": get_song_info_by_id(
            result.map(item =>
                mapping[item.target] || item.target
            )
        )
    };
}


/**
 * 计算两段文本之间的莱文斯坦距离
 * 
 * @param {string} a 第一段文本
 * @param {string} b 第二段文本
 * @returns {number} 计算出来的相似度
 */
function get_levenshtein_distance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * 通过指定的配置计算两个文本之间的相似度（返回符合 [0, 1] 的分数）
 * 
 * @param {string} a 第一段文本
 * @param {string} b 第二段文本
 * @param {object} options 计算时应用的配置
 * @param {boolean} options.case 是否忽略大小写
 * @returns {number} 计算出来的相似度
 */
function get_similarity(a, b, options = {}) {
    if (options.case === false) {
        a = a.toLowerCase();
        b = b.toLowerCase();
    }

    const distance = get_levenshtein_distance(a, b);

    return 1 - distance / Math.max(a.length, b.length);
}

const weight = {
    "Unmarked": 0,
    "翻唱": 0.6, "原创": 1,
    "串烧": 0.5, "本家重置": 0.75
};

/**
 * 通过曲目 Song 数据的 Name 查询对应的曲目数据
 * 
 * @param {string} target 需要查询的目标
 * @param {number} threshold 相似度阈值
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 查询的返回结果
 */
export function search_song_by_name(target, threshold = 0.2, count = 50, index = 1) {
    const result = [];

    for (const item of config.current.catalog.song) {
        const similarity = get_similarity(
            item.metadata.name, target, { "case": false }
        );

        if (similarity >= threshold) {
            result.push({
                "rate": similarity,
                "target": item
            });
        }
    }

    result.sort((a, b) => {
        return b.rate - a.rate;
    });

    result.sort((a, b) => {
        if (!a.metadata || !b.metadata) return 0;

        return weight[b.metadata.type] - weight[a.metadata.type];
    });

    const slice = pagination(count, index);

    return {
        "total": result.length,
        "result": get_song_info_by_id(result.slice(
            slice.offset, slice.offset + slice.limit
        ).map(item => item.target.metadata.id)).map(
            (item, index) => Object.assign(item, {
                "similarity": result[index].rate
            })
        )
    };
}

/**
 * 通过曲目 Song 数据的 Title 查询对应的曲目数据
 * 
 * @param {string} target 需要查询的目标
 * @param {number} threshold 相似度阈值
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 查询的返回结果
 */
export function search_song_by_title(target, threshold = 0.2, count = 50, index = 1) {
    const result = [];

    for (const item of config.current.catalog.song) {
        const similarity = get_similarity(
            item.platform.title, target, { "case": false }
        );

        if (similarity >= threshold) {
            result.push({
                "rate": similarity,
                "target": item
            });
        }
    }

    result.sort((a, b) => {
        return b.rate - a.rate;
    });

    result.sort((a, b) => {
        if (!a.metadata ||  !b.metadata) return 0;

        return weight[b.metadata.type] - weight[a.metadata.type];
    });

    const slice = pagination(count, index);

    return {
        "total": result.length,
        "result": get_song_info_by_id(result.slice(
            slice.offset, slice.offset + slice.limit
        ).map(item => item.target.metadata.id)).map(
            (item, index) => Object.assign(item, {
                "similarity": result[index].rate
            })
        )
    };
}

const define = {
    "list": [ "vocalist", "producer", "uploader", "synthesizer" ],
    "equal": [ "type", "copyright" ]
};

/**
 * 通过曲目 Song 数据并结合 Filter 查询对应的曲目数据
 * 
 * @param {object} filter 需要查询的目标
 * @param {string} sort 排序字段
 * @param {("asc"|"desc")} order 排序方式
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 查询的返回结果
 */
export function search_song_by_filter(filter, sort, order, count = 50, index = 1) {
    const result = [];

    for (const item of config.current.catalog.song) {
        const publish = new Date(item.platform.publish);

        const { publish_start: start, publish_end: end } = filter;

        if (
            (end && publish > end) ||
            (start && publish < start)
        ) continue;

        if (filter.keywords) {
            const name = item.metadata.name.toLowerCase();

            const result = filter.keywords.every(
                item => name.includes(item.toLowerCase())
            );

            if (!result) continue;
        }

        let flag = true;

        for (const [ field, value ] of Object.entries(filter)) {
            if (define.list.includes(field)) {
                const list = {
                    "include": [], "exclude": []
                };

                value.forEach(item => {
                    if (item.startsWith("!")) {
                        list.exclude.push(item.slice(1));
                    } else {
                        list.include.push(item);
                    }
                });

                const temp = item.metadata.target[field];
                
                if (
                    (list.include.length && !list.include.includes(temp)) ||
                    (list.exclude.length && list.exclude.includes(temp))
                ) {
                    flag = false;
                }
            }

            if (define.equal.includes(field) && item.metadata[field] !== value) {
                flag = false;
            }
        }

        if (flag) {
            result.push(item);
        }
    }
    
    result.sort((a, b) => {
        let basis = {}; // 排序的依据

        // 按照发布日期

        if (sort === "publish_date") {
            basis.a = new Date(a.platform.publish).getTime();
            basis.b = new Date(b.platform.publish).getTime();
        }

        // 按照播放量数据

        if (sort.startsWith("stat")) {
            const type = sort.slice(5); // stat.xxx 的 xxx 部分

            if (!a.platform.stat) return;

            if (!b.platform.stat) return;

            basis.a = a.platform.stat[type];
            basis.b = b.platform.stat[type];
        }

        // 按照上榜次数（周榜、日榜）

        if (sort.startsWith("count")) {
            const type = sort.slice(6); // count.xxx 的 xxx 部分

            basis.a = a.count[type];
            basis.b = b.count[type];
        }

        // 按照视频持续时长

        if (sort === "duration") {
            basis.a = a.platform.duration;
            basis.b = b.platform.duration;
        }

        // 按照视频分页数量

        if (sort === "page") {
            basis.a = a.platform.page;
            basis.b = b.platform.page;
        }

        if (sort === "default") {
            basis.a = 0;
            basis.b = 0;
        }

        if (order === "desc") {
            return basis.b - basis.a; // 倒序
        }

        return basis.a - basis.b; // 正序
    });

    result.sort((a, b) => {
        return weight[b.metadata.type] - weight[a.metadata.type];
    });

    const slice = pagination(count, index);

    return {
        "total": result.length,
        "result": get_song_info_by_id(result.slice(
            slice.offset, slice.offset + slice.limit
        ).map(item => item.metadata.id))
    };
}

/**
 * 通过目标数据的 Name 查询对应的目标列表
 * 
 * @param {("uploader"|"vocalist"|"producer"|"synthesizer")} type 目标类型
 * @param {string} target 需要查询的目标
 * @param {number} threshold 相似度阈值
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 查询的返回结果
 */
export function search_target_by_name(type, target, threshold = 0.2, count = 50, index = 1) {
    const result = [];

    config.current.catalog[type].forEach(item => {
        const similarity = get_similarity(
            item.name, target, { "case": false }
        );

        if (similarity >= threshold) {
            result.push({
                "rate": similarity,
                "target": item
            });
        }
    });

    result.sort((a, b) => {
        return b.rate - a.rate;
    });

    const slice = pagination(count, index);

    return {
        "total": result.length,
        "result": result.slice(slice.offset, slice.offset + slice.limit)
    };
}

/**
 * 获取曲目列表（通过 Pool 识别码）
 * 
 * @param {string} target 需要获取到的目标的 Pool 的识别码
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的曲目列表
 */
export function get_song_list_by_pool_id(target, count = 50, index = 1) {
    const part = target.split("-");
    const [ type, pool ] = part;

    if (![ "view", "like", "coin", "favorite" ].includes(type)) {
        return null;
    }

    const latest = config.current.metadata.snapshot.at(-1);

    
    /**
     * 获取指定 Pool 信息对应的曲目列表
     * 
     * @param {string} type 需要获取的 Pool 的类型
     * @param {number} latest 需要获取的最新的 snapshot_at
     * @param {number[]} range 需要获取的 Pool 的范围
     * @param {number} count 要获取多少个
     * @param {number} index 当前的页数
     * @returns 获取到的曲目列表
     */
    function get_list(type, latest, range, count, index) {
        const where = [
            {
                "column": "snapshot_at",
                "operator": "equal",
                "value": latest
            },
            {
                "column": type,
                "operator": "range",
                "value": {
                    "maximum": range[0],
                    "minimum": range[1]
                }
            }
        ];

        const depend = get_depend_board_entry_info();

        const result = operator.select_item("Snapshot_Table", {
            where, "control": {
                "order": {
                    "column": type,
                    "method": "descending"
                },
                "result": pagination(count, index)
            }
        });

        const mapping = Object.fromEntries(
            operator.select_item("Mark_Table", {
                "where": [
                    {
                        "column": "type",
                        "operator": "equal",
                        "value": "platform"
                    },
                    {
                        "column": "value",
                        "operator": "within",
                        "value": result.map(
                            item => item.target
                        )
                    }
                ]
            }).map(item => ([
                item.value, item.target
            ]))
        );

        const info = Object.fromEntries(
            get_song_info_by_id(
                unique_array(
                    Object.values(mapping)
                )
            ).map(item => ([
                item.metadata.id, item
            ]))
        );

        return {
            "total": operator.count_item(
                "Snapshot_Table", { where }
            )[0]["COUNT(*)"],
            "result": result.map(
                (target, index) => ({
                    "rank": index + 1,
                    "count": {
                        "view": target.view,
                        "like": target.like,
                        "coin": target.coin,
                        "favorite": target.favorite
                    },
                    "target": depend.parse_target(
                        info[mapping[target.target]],
                        target.target
                    )
                })
            )
        };
    }

    if ("ar".includes(pool[0].toLowerCase())) {
        const range = [];
        const level = parseInt(pool.slice(1));

        pool[0] = pool[0].toLowerCase();

        range[0] = 10 ** (level + 4);

        if (pool[0] == "r") {
            range[1] = 10 ** (level + 3);
        }

        if (pool[0] == "a") {
            range[1] = 10 ** (level + 4) * 0.9;
        }

        return get_list(type, latest.date, range, count, index);
    }
}

export function close() {
    return instance.close();
}