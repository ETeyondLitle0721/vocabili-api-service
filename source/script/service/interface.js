import fs from "fs";
import url from "url";
import cors from "cors";
import path from "path";
import ansi from "../../depend/utilities/sequence/ansi.js";
import HTTP from "http";
import express from "express";
import template from "../../depend/utilities/template.js";
import levenshtein from "fast-levenshtein";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import {
    unique_array, classification, text_transformer as capitalize
} from "../../depend/core.js";
import {
    parse_parameter, check_parameter, build_response
} from "./core/depend.js";
import {
    get_board_metadata_info_by_board_id as get_board_metadata_info_by_id,
    get_board_song_list, get_mark_info_by_target_id, get_rank_by_song_id,
    base as database, get_target_info_by_id, metadata_define
} from "./core/interface.js";

const root = path.resolve(".");

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {import("../../depend/operator/database.js").GeneralObject} GeneralObject
 */

const field = "interface";

const config = JSON.parse(
    fs.readFileSync(path.resolve(
        root, "./config.json"
    ), "UTF-8")
);

const rule = {
    "param": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/param.json"
        ))
    )
};

const language = {
    "text": JSON.parse(
        fs.readFileSync(path.resolve(
            root, config.language.filepath
        ), "UTF-8")
    ),
    "default": config.language.default
};

const application = express();

const service_config = config.service.options[field];

if (service_config.cors) {
    application.use(cors(
        service_config.cors
    ));
}

/**
 * 从数据库中现有的数据中获取曲目信息（包含标记信息）
 * 
 * @param {string[]} ids 需要获取信息的曲目的识别码列表
 * @returns 获取到的曲目数据
 */
function get_song_info_by_id(ids = []) {
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
    
        song_mark.vocalist && song_mark.vocalist.forEach(
            id => metadata.target.vocalist.push({
                "id": id, "name": target[id].name,
                "color": target[id].color
            })
        );

        song_mark.producer && song_mark.producer.forEach(
            id => metadata.target.producer.push({
                "id": id, "name": target[id].name
            })
        );
    
        song_mark.synthesizer && song_mark.synthesizer.forEach(
            id => metadata.target.synthesizer.push({
                "id": id, "name": target[id].name
            })
        );
            
        const platform = [];
    
        song_mark.platform && song_mark.platform.forEach(
            id => platform.push(parse_platform(
                id, target, uploader
            ))
        );
    
        return { metadata, platform };
    };
    
    const parse_platform = (id, platform, uploader) => {
        const info = platform[id];
    
        const result = {
            "id": id, "page": info.page,
            "link": info.link.replace("BB://V/", "https://b23.tv/"),
            "publish": info.published_at, "title": info.title, "uploader": [],
            "duration": info.duration, "copyright": info.copyright,
            "thumbnail": info.thumbnail.replace(
                "BB://I/", "https://i0.hdslb.com/bfs/archive/"
            )
        };
    
        uploader[id] && uploader[id].forEach(
            item => result.uploader.push({
                "id": item.value, "name": target[item.value].name
            })
        );
    
        return result;
    };

    const get_mark_info_by_song_list = song_list => {
        return Object.fromEntries(Object.entries(
            classification(
                get_mark_info_by_target_id(song_list),
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
    };
    
    const get_target_info_by_mark_info = mark_info => {
        return Object.fromEntries(
            get_target_info_by_id(
                [ "producer", "vocalist", "synthesizer", "platform" ],
                Object.values(mark_info).flat().map(
                    item => Object.values(item)
                ).flat(2)
            ).map(item => item.response).flat().map(
                item => ([ item.id, item ])
            )
        );
    };
    
    const get_uploader_info_by_mark_info = mark_info => {
        return classification(
            get_mark_info_by_target_id(
                Object.values(mark_info).map(
                    item => Object.values(item)
                ).flat(2).filter(
                    item => item.startsWith("Platform:")
                )
            ), value => value.target
        );
    };

    const song = get_target_info_by_id("song", ids);
    const mark = get_mark_info_by_song_list(song.map(
        item => item.id
    ));
    const target = get_target_info_by_mark_info(mark);
    const uploader = get_uploader_info_by_mark_info(mark);

    const uploader_ids = Object.values(uploader).flat().map(item => item.value);

    get_target_info_by_id("uploader", uploader_ids).forEach(
        temp => target[temp.id] = temp
    );

    const map = Object.fromEntries(song.map(
        item => ([ item.id, item ])
    ));

    return ids.map(id => parse_song(
        map[id], mark, target, uploader
    ));
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
function get_board_info_by_entry(issue, board = "vocaoid-weekly", count = 50, index = 1, part) {
    const list = get_board_song_list({ issue, count, index, board, part });
    const metadata = {
        "board": get_board_metadata_info_by_id(board)
    };

    metadata.issue = metadata.board.catalog.find(
        item => item.issue === issue
    );

    const parse_song = song => {
        return {
            "rank": {
                "view": song.view_rank, "like": song.like_rank,
                "coin": song.coin_rank, "board": song.rank,
                "favorite": song.favorite_rank
            }, "count": song.count ?? 0, "change": {
                "view": song.view_change, "like": song.like_change,
                "coin": song.coin_change, "favorite": song.favorite_change
            }, "target": parse_target(
                target[song.target], song.platform
            )
        };
    };

    const parse_target = (target, platform) => {
        for (const [ field, value ] of Object.entries(target)) {
            if (field === "platform") {
                target[field] = value.find(
                    item => item.id === platform
                ) || {};
            }
        }

        return target;
    };

    const song_ids = list.map(item => item.target);

    const target = Object.fromEntries(
        get_song_info_by_id(song_ids).map(item => ([
            item.metadata.id, item
        ]))
    );
    
    const result = {
        "board": list.map(
            song => parse_song(song)
        ),
        "metadata": {
            "id": board, "name": metadata.name,
            "date": metadata.issue.date,
            "part": list[0].part, "issue": issue,
            "count": metadata.issue.part[list[0].part]
        }
    };

    get_rank_by_song_id({
        board, count, "issue": [ issue - 1 ], "target": song_ids
    }).map(last => (result.board[song_ids.indexOf(last.target)].last = {
        "rank": last.rank,
        "point": last.point
    }));

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
function get_current_board_info_by_entry(board = "vocaoid-weekly", count = 50, index = 1, part) {
    const metadata = get_board_metadata_info_by_id(board);

    return get_board_info_by_entry(
        metadata.catalog.at(-1).issue, board, count, index, part
    );
}

/**
 * 获取曲目历史统计量信息
 * 
 * @param {string} target 需要曲目
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的排行榜信息
 */
function get_platform_count_history_info_by_id(target, count = 50, index = 1) {
    const where = {
        "column": "target",
        "operator": "equal",
        "value": target
    };

    const history = database.select_item("Snapshot_Table", {
        where, "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });

    return {
        "total": database.count_item(
            "Snapshot_Table", { where }
        )[0]["COUNT(*)"],
        "result": history.map(item => ({
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
function get_song_rank_history_info_by_id(target, issue, board, count = 50, index = 1) {
    const rank = get_rank_by_song_id({
        count, index, target, issue, board
    });

    return rank.map(item => ({
        "rank": {
            "view": item.view_rank, "like": item.like_rank, "board": item.rank,
            "coin": item.coin_rank, "favorite": item.favorite_rank
        }, "target": item.target, "point": item.point, "change": {
            "view": item.view_change, "like": item.like_change,
            "coin": item.coin_change, "favorite": item.favorite_change
        }, "issue": item.issue, "board": item.board
    })).filter(item => item.rank.coin > 0);
}

const instance = database.instance;

instance.function("levenshtein", (str1, str2) => {
    return levenshtein.get(str1, str2, {
        "useCollator": true
    });
});

/**
 * 通过曲目 Platform 数据的 BVID 或者 Title 查询对应的曲目数据
 * 
 * @param {object} target 需要查询的目标
 * @param {string} target.bvid 需要包含的 BVID 之中的文本
 * @param {string} target.title 需要包含的 Title 之中的文本
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的曲目列表
 */
function search_song_by_platform_title(target, count = 50, index = 1) {
    const { bvid = "", title = "" } = target;
    const where = [
        {
            "column": "title",
            "operator": "like",
            "value": `%${title}%`,
            "collate": "nocase"
        },
        {
            "column": "link",
            "operator": "like",
            "value": `BB://V/%${bvid}%`,
            "collate": "nocase"
        }
    ];

    const platform = database.select_item("Platform_Table", {
        where, "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });
    
    const mark = database.select_item("Mark_Table", {
        "where": [
            {
                "column": "type",
                "operator": "equal",
                "value": "platform"
            },
            {
                "column": "value",
                "operator": "within",
                "value": platform.map(item => item.id)
            }
        ]
    });

    return {
        "total": database.count_item(
            "Platform_Table", { where }
        )[0]["COUNT(*)"],
        "result": get_song_info_by_id(
            mark.map(item => item.target)
        )
    };
}

/**
 * 通过曲目 Song 数据的 Name 查询对应的曲目数据
 * 
 * @param {object} name 需要查询的目标
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的曲目列表
 */
function search_song_by_name(name, count = 50, index = 1) {
    const list = instance.prepare(`
        SELECT
            *, levenshtein(name, :name) AS distance
        FROM Song_Table
        WHERE distance <= LENGTH(:name)
        ORDER BY
            CASE WHEN type = 'Unmarked' THEN 1 ELSE 0 END, distance ASC
        LIMIT :count OFFSET :offset
    `).all({
        name, count, "offset": count * (index - 1)
    });

    return {
        "total": instance.prepare(`
            SELECT COUNT(*) FROM (
                SELECT levenshtein(name, :name) AS distance
                FROM Song_Table
                WHERE distance <= LENGTH(:name)
            ) AS subquery
        `).all({ name })[0]["COUNT(*)"],
        "result": get_song_info_by_id(
            list.map(item => item.id)
        )
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
function get_target_list_by_type(type, count = 50, index = 1) {
    if (type === "board") {
        const board = metadata_define.board;

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

    const table_name = capitalize(type) + "_Table";

    const where = type === "song" ? {
        "column": "type",
        "operator": "<>",
        "value": "Unmarked"
    } : {};

    const result = database.select_item(table_name, {
        where, "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });

    return {
        "total": database.count_item(
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
function get_song_list_by_mark(type, target, count = 50, index = 1) {
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

    const result = database.select_item("Mark_Table", {
        where, "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });

    const mapping = type === "uploader" ? (
        Object.fromEntries(
            database.select_item("Mark_Table", {
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
        )
    ) : {};

    return {
        "total": database.count_item(
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
 * 通过目标数据的 Name 查询对应的目标列表
 * 
 * @param {("uploader"|"vocalist"|"producer"|"synthesizer")} type 目标类型
 * @param {string} name 目标名称
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的目标列表
 */
function search_target_by_name(type, name, count, index) {
    const where = {
        "column": "name",
        "operator": "like",
        "value": `%${name}%`,
        "collate": "nocase"
    };

    const table_name = capitalize(type) + "_Table";

    const list = database.select_item(table_name, {
        where, "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });

    let result = list.map(item => ({
        "id": item.id,
        "name": item.name
    }));

    if (type === "vocalist") result = list.map(item => ({
        "id": item.id,
        "name": item.name,
        "color": item.color
    }));

    return {
        "total": database.count_item(
            table_name, { where }
        )[0]["COUNT(*)"],
        "result": result
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
function get_song_list_by_pool_id(target, count = 50, index = 1) {
    if (target.includes("-")) {
        const part = target.split("-");
        const [ type, pool ] = part;

        if (![ "view", "like", "coin", "favorite" ].includes(type)) {
            return {
                "total": -1,
                "result": []
            };
        }

        function get_list(range, count, index) {
            const where = [
                {
                    "column": "snapshot_at", "operator": "equal",
                    "value": metadata_define.snapshot.at(-1).date
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

            const result = database.select_item("Snapshot_Table", {
                where, "control": {
                    "order": {
                        "column": type,
                        "method": "descending"
                    },
                    "result": {
                        "limit": count,
                        "offset": count * (index - 1)
                    }
                }
            });

            const mapping = Object.fromEntries(
                database.select_item("Mark_Table", {
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
                "total": database.count_item(
                    "Snapshot_Table", { where }
                )[0]["COUNT(*)"],
                "result": result.map((target, index) => {
                    return {
                        "rank": index + 1,
                        "count": {
                            "view": target.view,
                            "like": target.like,
                            "coin": target.coin,
                            "favorite": target.favorite
                        },
                        "target": Object.fromEntries(
                            Object.entries(info[
                                mapping[target.target]
                            ] || {}).map(([key, value]) => {
                                if (key === "platform") {
                                    value = value.find(item => item.id === target.target);
                                };
            
                                return [
                                    key, value
                                ];
                            })
                        )
                    };
                })
            };
        }

        if ("ar".includes(pool[0].toLowerCase())) {
            const amount = parseInt(pool.slice(1));

            if (pool[0].toLowerCase() == "r") return get_list([
                10 ** (amount + 4),
                10 ** (amount + 3)
            ], count, index);

            if (pool[0].toLowerCase() == "a") return get_list([
                10 ** (amount + 4),
                10 ** (amount + 4) * 0.9
            ], count, index);
        }
    }
}

/**
 * 检查目标有效性
 * 
 * @typedef CheckExistsEntry
 * @property {number} issue 目标的期数
 * @property {string} [part] 目标子刊
 * @property {boolean} exists 检查结果
 * 
 * @param {object} metadata 榜单元数据
 * @param {string} part 子刊代号
 * @param {number[]} issue 期数代号
 * @returns {CheckExistsEntry[]} 检查结果
 */
function check_exists_board_entry(metadata, part, issues) {
    const result = [], mapping = new Map();

    metadata.catalog.forEach(item => {
        mapping.set(
            item.issue.toString(), item
        );
    });

    for (let index = 0; index < issues.length; index++) {
        const issue = issues[index];

        const target = mapping.get(issue);
        
        if (!target) {
            result.push({
                "issue": issue,
                "exists": false
            });

            continue;
        }

        if (!target.part[part]) {
            result.push({
                issue, part,
                "exists": false
            });

            continue;
        }

        result.push({
            issue, part,
            "exists": true
        });
    }

    return result;
}

/**
 * 注册不同方法的路由
 * 
 * @param {string} router 路由定义字符串
 * @param {Parameters<typeof application.post>[1]} handler 处理方法
 * @param {("get"|"post")[]} method 需要注册的方法
 * @returns 方法返回值
 */
application.register = (router, handler, method = [ "get", "post" ]) => {
    return method.forEach(method => {
        return application[method](router, handler);
    });
}

const map = {
    "zh": "zh-TW",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "es": "es-ES",
    "fr": "fr-FR",
    "en": "en-US",
    "de": "de-DE"
};

application.use((req, res, next) => {
    console.log(template.replace(
        "{{datetime}} {{level}} {{message}}", {
            "datetime": ansi.encode({
                "text": "[" + format_datetime(
                    datetime.format, new Date()
                ) + "]",
                "color": {
                    "background": "green"
                }
            }),
            "level": ansi.encode({
                "text": "(Info)",
                "color": {
                    "background": "cyan"
                }
            }),
            "message": ansi.encode({
                "text": "接收到来自客户端的 HTTP 请求",
                "color": {
                    "background": "yellow"
                }
            })
        }
    ));

    console.log(`请求来源: ${req.headers["x-real-ip"] || req.socket.remoteAddress} (Port=${req.socket.remotePort}, Famliy=${req.socket.remoteFamily})`);
    console.log(`请求目标: ${req.path} (Method=${req.method})`);
    console.log("携带参数:", parse_parameter(req));

    const list = req.acceptsLanguages().map(
        item => map[item] ? map[item] : item
    );

    const code = list.filter(code => list.includes(code))[0];

    const text = language.text[code] || language.text[language.default];

    res.get_local_text = (entry, param) => {
        return template.replace(
            text[entry] || text.UNKNOWN_TEXT_ENTRY,
            typeof param === "object" ? param : {}
        );
    };

    next();
});

/**
 * 检查简单参数是否符合要求
 * 
 * @param {Object<string, string[]>} param 参数列表
 * @param {number} receive 请求接收时间
 * @param {{ "request": Express.Request, "response": Express.Response }} instance Express 实例
 * @returns {boolean} 是否通过了检查
 */
function check_param(param, receive, instance) {
    const { request } = instance;

    const route_rule = rule.param[request.route.path];

    if (!route_rule) return true;

    function _check(field, rule, value) {
        if (rule.mode !== "count") {
            value = value[0];
        }

        return check_parameter(
            instance, field, receive,
            value, rule.mode, rule.options
        );
    }

    for (let [ field, rule ] of Object.entries(route_rule)) {
        if (!Array.isArray(rule)) {
            rule = [ rule ];
        }

        for (let index = 0; index < rule.length; index++) {
            const current = rule[index];
            
            if (!_check(field, current, param[field])) {
                return false;
            }
        }
    }

    return true;
}

application.register("/get_info/song", (request, response) => {
    /**
     * @type {{ "target": string[] }}
     */
    const param = parse_parameter(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    return response.send(build_response(instance, {
        param, receive, "data": get_song_info_by_id(param.target)
    }, "OK"));
});

application.register("/get_list/song/by_:type", (request, response) => {
    /**
     * @type {{ "type": ("pool"|"uploader"|"vocalist"|"producer"|"synthesizer"), "count": number, "index": number, "target": string }}
     */
    const param = Object.assign({
        "count": [ "50" ], "index": [ "1" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    if (param.type === "pool") return response.send(build_response(instance, {
        param, receive, "data": get_song_list_by_pool_id(
            param.target, +param.count, +param.index
        )
    }, "OK"));

    return response.send(build_response(instance, {
        param, receive, "data": get_song_list_by_mark(
            param.type, param.target, +param.count, +param.index
        )
    }, "OK"));
});

application.register("/get_list/:type", (request, response) => {
    /**
     * @type {{ "type": ("song"|"board"|"uploader"|"vocalist"|"producer"|"synthesizer"), "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": [ "20" ], "index": [ "1" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_target_list_by_type(
            param.type, +param.count, +param.index
        )
    }, "OK"));
});

application.register("/get_info/board", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number, "issue": number[], "part": string }}
     */
    const param = Object.assign({
        "count": [ "50" ], "index": [ "1" ], "part": [ "main" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_info_by_id(param.board);

    if (!metadata) return response.send(
        build_response(instance, {
            param, receive
        }, "BOARD_NOT_EXISTS")
    );

    const target = metadata.catalog.find(
        item => item.issue === +param.issue
    );

    if (!target) return response.send(
        build_response(instance, {
            param, receive
        }, "ISSUE_NOT_EXISTS")
    );

    if (!target.part[param.part]) {
        return response.send(
            build_response(instance, {
                param, receive 
            }, "PART_NO_EXISTS")
        );
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_board_info_by_entry(
            +param.issue, param.board, +param.count,
            +param.index, param.part
        )
    }, "OK"));
});

application.register("/get_info/board/_latest", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number, "part": string }}
     */
    const param = Object.assign({
        "count": [ "50" ], "index": [ "1" ], "part": [ "main" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_info_by_id(param.board);

    if (!metadata) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    if (metadata.catalog.length === 0) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "NO_ENTRY_EXISTS")
        );
    }

    if (!metadata.catalog.at(-1).part[param.part]) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "PART_NO_EXISTS")
        );
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_current_board_info_by_entry(
            param.board, +param.count, +param.index, param.part
        )
    }, "OK"));
});

application.register("/get_info/metadata/board", (request, response) => {
    /**
     * @type {{ "target": string, "set-cache": number }}
     */
    const param = Object.assign({ "set-cache": [ "0" ] }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    if (param["set-cache"] !== 0) {
        response.setHeaders("Cache-Control", "public, max-age=" + param["set-cache"]);
    }

    if (get_board_metadata_info_by_id(param.target)) {
        return response.send(build_response(instance, {
            param, receive, "data":
                get_board_metadata_info_by_id(param.target)
        }, "OK"));
    }

    return response.send(build_response(instance, {
        param, receive, "data": null
    }, "BOARD_NOT_EXISTS", "目标榜单不存在。"));
});

application.register("/get_history/song/rank", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number, "issue": number[], "target": string }}
     */
    const param = Object.assign({
        "count": [ "50" ], "index": [ "1" ], "issue": []
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (param.issue.length > 1) {
        const result = check_parameter(
            instance, "issue", receive,
            param.issue, "count", {
                "range": { "maximum": 128 }
            }
        );

        if (!result) return;
    }

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_song_rank_history_info_by_id(
            param.target, +param.issue, param.board,
            +param.count, +param.index
        )
    }, "OK"));
});

application.register("/get_history/platform/count", (request, response) => {
    /**
     * @type {{ "count": number, "index": number, "target": string }}
     */
    const param = Object.assign({
        "count": [ "300" ], "index": [ "1" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_platform_count_history_info_by_id(
            param.target, +param.count, +param.index
        )
    }, "OK"));
});

application.register("/search/song/by_name", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": [ "25" ], "index": [ "1" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_name(
            param.target, +param.count, +param.index
        )
    }, "OK"));
});

application.register("/search/song/by_platform", (request, response) => {
    /**
     * @type {{ "title": string, "bvid": string, "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": [ "25" ], "index": [ "1" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!param.title && !param.bvid) {
        return response.send(build_response(
            instance, { receive }, "NOT_FOUND_VALID_VALUE", {
                "TARGET_PARAMETER": [
                    "BVID", "NAME"
                ].map(item => response.get_local_text(
                    "TARGET_PARAMETER",
                    { "name": item }
                )).join(response.get_local_text(
                    "NOT_FOUND_VALID_VALUE_JOINER"
                ))
            }
        ));
    }
    
    if (param.bvid) {
        if (!check_parameter(instance, "bvid", receive, param.bvid, "count", {
            "range": { "maximum": 1 }
        })) return;
    }

    if (param.title) {
        if (!check_parameter(instance, "title", receive, param.title, "count", {
            "range": { "maximum": 1 }
        })) return;
    }

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_platform_title({
                "bvid": param.bvid, "title": param.title
            }, +param.count, +param.index
        )
    }, "OK"));
});

application.register("/search/:type/by_name", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number, "type": string }}
     */
    const param = Object.assign({
        "count": [ "25" ], "index": [ "1" ]
    }, parse_parameter(request));
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_target_by_name(
            param.type, param.target, +param.count, +param.index
        )
    }, "OK"));
});

application.register("/check/exists/board-entry", (request, response) => {
    /**
     * @type {{ "board": string, "issue": number, "part": string }}
     */
    const param = parse_parameter(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    const metadata = get_board_metadata_info_by_id(param.board);

    if (!metadata) return response.send(
        build_response(instance, {
            param, receive
        }, "BOARD_NOT_EXISTS")
    );

    const result = check_exists_board_entry(
        metadata, param.part[0], param.issue
    );

    return response.send(build_response(instance, {
        param, receive, "data": {
            result, "metadata": {
                "name": metadata.name,
                "board": param.board[0],
                "count": metadata.catalog.length
            }
        }
    }, "OK"));
});

application.use((request, response) => {
    return response.send({
        "code": "NOT_FOUND",
        "time": new Date().toISOString(),
        "status": "failed",
        "target": request.path,
        "message": response.get_local_text("NOT_FOUND")
    });
});

/**
 * 在指定的 Port 和 Host 上启用监听服务
 * 
 * @returns {HTTP.Server} 监听指定配置的 HTTP Server 实例化对象
 */
export function start_service() {
    const address = `http://${service_config.host}:${service_config.port}/`;

    const server = application.listen(
        service_config.port, service_config.host, (error) => {
            if (error) {
                throw new Error(`在 ${address} 上启用 Default 服务时遇到错误：`, {
                    "cause": "服务提供器监听指定端口失败",
                    "error": error
                });
            }

            console.log(`成功在 ${address} 上启用 ${capitalize(
                field, 1, (text) => text.toUpperCase()
            )} 服务`);
        }
    );

    server.on("error", (error) => {
        console.log("服务器在执行 JavaScript 脚本文件时遇到未捕获错误", error);
    });

    return server;
}

export default {
    "start": start_service
};