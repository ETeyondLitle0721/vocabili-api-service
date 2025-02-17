import fs from "fs"; import path from "path"; import HTTP from "http";
import ansi from "../../depend/utilities/sequence/ansi.js"; import cors from "cors";
import express from "express"; import template from "../../depend/utilities/template.js";
import { classification, get_type, text_transformer as capitalize, unique_array } from "../../depend/core.js";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import { parse_parameter, check_parameter, build_response } from "./depend/default.js";
import {
    get_board_metadata_info_by_board_id as get_board_metadata_info_by_id,
    get_board_song_list, get_mark_info_by_target_id, get_rank_by_song_id,
    base as database, get_song_history_info, get_target_info_by_id, metadata_define
} from "./core/interface.js";

const root = path.resolve(".");

/**
 * @typedef {import("../../depend/operator/database.js").GeneralObject} GeneralObject
 */

const config = JSON.parse(
    fs.readFileSync(path.resolve(
        root, "./config.json"
    ), "UTF-8")
), field = "interface";

const service_config = config.service.options[field];

const application = express();

if (service_config.cors) {
    application.use(cors(
        service_config.cors
    ));
}

application.use((req, _res, next) => {
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

    next();
});

/**
 * 获取曲目数据
 * 
 * @param {string[]} list 需要获取信息的曲目的识别码列表
 * @returns 获取到的曲目数据
 */
function song_info(list = []) {
    const song = get_target_info_by_id(
        "song", list
    );

    const mark = Object.fromEntries(Object.entries(
        classification(
            get_mark_info_by_target_id(list), value => {
                return value.target;
            }
        )
    ).map(([key, value]) => ([
        key, Object.fromEntries(Object.entries(
            classification(value, value => value.type)
        ).map(([key, value]) => ([
            key, unique_array(value.map(item => item.value))
        ])))
    ])));

    const target = Object.fromEntries(
        get_target_info_by_id(
            [ "producer", "vocalist", "synthesizer", "platform" ],
            Object.values(mark).flat().map(item => Object.values(item)).flat(2)
        ).map(item => item.response).flat().map(item => ([
            item.id, item
        ]))
    );

    const uploader = classification(
        get_mark_info_by_target_id(
            Object.values(mark).map(item => Object.values(item)).flat(2).filter(item => item.startsWith("Platform:"))
        ), (value) => value.target
    );

    get_target_info_by_id(
        "uploader",  Object.values(uploader).flat().map(item => item.value)
    ).map(temp => target[temp.id] = temp);

    return song.map(song => {
        const marked_data = mark[song.id], temp = {
            "sv": marked_data.synthesizer ? marked_data.synthesizer.map(id => ({
                "id": id, "name": target[id].name
            })) : [],
            "vocalist": marked_data.vocalist ? marked_data.vocalist.map(id => ({
                "id": id, "name": target[id].name, "color": target[id].color
            })) : []
        };

        return {
            "metadata": {
                "id": song.id, "name": song.name, "type": song.type, "target": {
                    "vocalist": temp.vocalist.map(item => {
                        return item.name;
                    }).join("").length === 0 ? [] : temp.vocalist,
                    "producer": marked_data.producer.map(id => ({
                        "id": id, "name": target[id].name
                    })),
                    "synthesizer": temp.sv.map(item => {
                        return item.name;
                    }).join("").length === 0 ? [] : temp.sv
                }
            }, "platform": marked_data.platform ? marked_data.platform.map(id => {
                const info = target[id];
    
                return {
                    "id": id, "link": info.link.replace("BB://V/", "https://b23.tv/"),
                    "publish": info.published_at, "page": info.page, "title": info.title,
                    "uploader": uploader[id] ? uploader[id].map(item => ({
                        "id": item.value, "name": target[item.value].name
                    })) : [], "duration": info.duration,
                    "thumbnail": info.thumbnail.replace("BB://I/", "https://i0.hdslb.com/bfs/archive/"),
                    "copyright": info.copyright
                };
            }) : []
        }
    });
}

/**
 * 获取排行榜数据
 * 
 * @param {number} issue 需要获取数据的期数
 * @param {string} board 需要获取的排行榜
 * @param {number} count 要获取多少个
 * @param {number} index 页索引
 * @returns 获取到的排行榜信息
 */
function board_info(issue, board = "vocaoid-weekly-main", count = 50, index = 1) {
    const list = get_board_song_list({
        issue, count, index, board
    }), metadata = get_board_metadata_info_by_id(board);

    const issue_metadata = metadata.catalog.find(item => item.issue === issue);

    const song_id_list = list.map(item => item.target);

    const target = Object.fromEntries(
        song_info(song_id_list).map(item => ([
            item.metadata.id, item
        ]))
    );
    
    const result = {
        "board": list.map(song => ({
            "rank": {
                "view": song.view_rank, "like": song.like_rank,
                "coin": song.coin_rank, "board": song.rank,
                "favorite": song.favorite_rank
            }, "count": song.count || 0, "change": {
                "view": song.view_change, "like": song.like_change,
                "coin": song.coin_change, "favorite": song.favorite_change
            }, "target": Object.fromEntries(
                Object.entries(target[song.target] || {}).map(([key, value]) => {
                    if (key === "platform") {
                        value = value.find(item => item.id === song.platform);

                        value && delete value.id;
                    };

                    return [
                        key, value
                    ];
                })
            )
        })),
        "metadata": {
            "id": get_type(board).second === "array" ? board[0] : board,
            "name": metadata.name, "date": issue_metadata.date,
            "issue": issue, "count": issue_metadata.count
        }
    };

    get_rank_by_song_id({
        board, "count": count, "issue": [ issue - 1 ], "target": song_id_list
    }).map(last => (result.board[song_id_list.indexOf(last.target)].last = {
        "rank": last.rank, "point": last.point
    }));

    return result;
}

/**
 * 获取最新的排行榜
 * 
 * @param {string} board 需要获取的排行榜
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的排行榜信息
 */
function current_board_info(board = "vocaoid-weekly-main", count = 50, index = 1) {
    const metadata = get_board_metadata_info_by_id(board);

    return board_info(
        metadata.catalog.at(-1).issue, board, count, index
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
function song_count_history_info(target, count = 50, index = 1) {
    const history = get_song_history_info({
        target, count, index
    });

    return history.map(item => ({
        "date": item.snapshot_at, "count": {
            "view": item.view, "like": item.like,
            "coin": item.coin, "favorite": item.favorite
        }
    })).filter(item => item.count.coin > 0);
}

/**
 * 获取曲目历史排名信息
 * 
 * @param {string} target 目标曲目
 * @param {number[]} issue 需要获取的期数列表
 * @param {string[]} board 排名榜单
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的排行榜信息
 */
function song_rank_history_info(target, issue, board, count = 50, index = 1) {
    const rank = get_rank_by_song_id({
        count, index, target, "issue": issue || [], "board": board || []
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
            "value": `%${title}%`
        },
        {
            "column": "link",
            "operator": "like",
            "value": `BB://V/%${bvid}%`
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
        "result": song_info(
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
    const where = {
        "column": "name",
        "operator": "like",
        "value": `%${name}%`
    };

    const list = database.select_item("Song_Table", {
        where, "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });

    return {
        "total": database.count_item(
            "Song_Table", { where }
        )[0]["COUNT(*)"],
        "result": song_info(
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
function get_target_list(type, count = 50, index = 1) {
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

    const result = database.select_item(table_name, {
        "control": {
            "result": {
                "limit": count,
                "offset": count * (index - 1)
            }
        }
    });

    return {
        "total": database.count_item(
            table_name
        )[0]["COUNT(*)"],
        "result": ((type, result) => {
            if (type === "song") return song_info(
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
 * @param {string} id 关联信息对应的识别码
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的曲目列表
 */
function get_song_list_by_mark(type, id, count = 50, index = 1) {
    const where = [
        {
            "column": "value",
            "operator": "equal",
            "value": id
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

    return {
        "total": database.count_item(
            "Mark_Table", { where }
        )[0]["COUNT(*)"],
        "result": song_info(
            result.map(item => item.target)
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
        "value": `%${name}%`
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

// 随缘编写，但是已经提上日程了（划掉
// /**
//  * 获取曲目列表（通过 Pool 识别码）
//  * 
//  * @param {string[]} target 需要获取到的目标的 Pool 的识别码
//  * @param {number} count 要获取多少个
//  * @param {number} index 当前的页数
//  * @returns 获取到的曲目列表
//  */
// function get_song_list_by_pool_id(target, count = 50, index = 1) {
//     const part = target.split("-");
//     const type = part[0], mode = part[1];
// }

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

application.register("/get_info/song", (request, response) => {
    /**
     * @type {{ "target": string[] }}
     */
    const param = parse_parameter(request);
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 200 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": song_info(
            param.target
        )
    }, "OK"));
});

application.register("/get_list/song/by_:type", (request, response) => {
    /**
     * @type {{ "type": ("pool"|"uploader"|"vocalist"|"producer"|"synthesizer"), "count": number, "index": number, "target": string }}
     */
    const param = Object.assign({
        "count": 50, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "type", receive, param.type, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "type", receive, param.type, "list", {
        "list": [ "pool", "uploader", "vocalist", "producer", "synthesizer" ]
    })) return;

    param.type = param.type[0];

    if (param.type === "pool") return response.send(build_response(
        instance, { receive }, "NOT_IMPLEMENTED_YET",
        "目前所访问的目标端点(ep=/get_list/by_pool)目前尚未实现。"
    ));

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 50 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": get_song_list_by_mark(
            param.type, param.target, param.count, param.index
        )
    }, "OK"));
});

application.register("/get_list/:type", (request, response) => {
    /**
     * @type {{ "type": ("song"|"board"|"uploader"|"vocalist"|"producer"|"synthesizer"), "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": 50, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "type", receive, param.type, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "type", receive, param.type, "list", {
        "list": [ "pool", "song", "board", "uploader", "vocalist", "producer", "synthesizer" ]
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 50 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": get_target_list(
            param.type[0], param.count, param.index
        )
    }, "OK"));
});

application.register("/get_info/board", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number, "issue": number[] }}
     */
    const param = Object.assign({
        "count": 50, "index": 1
    }, parse_parameter(request)), receive = process.uptime(), instance = {
        response, request
    };
    
    if (!check_parameter(instance, "board", receive, param.board, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "issue", receive, param.issue, "number", {
        "type": "integer",
        "range": { "minimum": -131072, "maximum": 131072 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 200 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    const metadata = get_board_metadata_info_by_id(param.board);

    if (!metadata) return response.send(
        build_response(instance, {
            param, receive, "data": null
        }, "BOARD_NOT_EXISTS", "目标榜单不存在。")
    );

    if (!metadata.catalog.some(item => item.issue === param.issue)) return response.send(
        build_response(instance, {
            param, receive, "data": null
        }, "ISSUE_NOT_EXISTS", "目标刊目不存在。")
    );

    return response.send(build_response(instance, {
        param, receive, "data": board_info(
            param.issue, param.board, param.count, param.index
        )
    }, "OK"));
});

application.register("/get_info/board/_current", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": 50, "index": 1
    }, parse_parameter(request)), receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "board", receive, param.board, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 200 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    const board_info = get_board_metadata_info_by_id(param.board);

    if (board_info) {
        if (board_info.catalog.length === 0) return response.send(build_response(
            instance, { receive }, "NO_ENTRY_EXISTS",
            "所访问的榜单目前没有任何刊目。"
        ));

        return response.send(build_response(instance, {
            param, receive, "data": current_board_info(
                param.board, param.count, param.index
            )
        }, "OK"));
    }

    return response.send(build_response(instance, {
        param, receive, "data": null
    }, "BOARD_NOT_EXISTS", "目标榜单不存在。"));
});

application.register("/get_info/metadata/board", (request, response) => {
    /**
     * @type {{ "target": string, "set-cache": number }}
     */
    const param = Object.assign({
        "set-cache": 0
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "set-cache", receive, param["set-cache"], "number", {
        "range": { "minimum": 0, "maximum": 131072 }
    })) return;

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (get_board_metadata_info_by_id(param.target[0])) {
        return response.send(build_response(instance, {
            param, receive, "data": get_board_metadata_info_by_id(param.target[0])
        }, "OK"));
    }

    if (param["set-cache"] !== 0) {
        response.setHeaders("Cache-Control", "public, max-age=" + param["set-cache"]);
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
        "count": 50, "index": 1, "board": [], "issue": []
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!Array.isArray(param.issue)) param.issue = [ param.issue ];

    if  (param.issue.length > 1 && !check_parameter(instance, "issue", receive, param.issue, "count", {
        "range": { "maximum": 128 }
    })) return;

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": -1, "maximum": 300 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": song_rank_history_info(
            param.target, param.issue, param.board, param.count, param.index
        )
    }, "OK"));
});

application.register("/get_history/song/count", (request, response) => {
    /**
     * @type {{ "count": number, "index": number, "target": string }}
     */
    const param = Object.assign({
        "count": 300, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": -1, "maximum": 300 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": song_count_history_info(
            param.target, param.count, param.index
        )
    }, "OK"));
});

application.register("/search/song/by_name", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": 25, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 50 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_name(
            param.target, param.count, param.index
        )
    }, "OK"));
});

application.register("/search/song/by_platform", (request, response) => {
    /**
     * @type {{ "title": string, "bvid": string, "count": number, "index": number }}
     */
    const param = Object.assign({
        "count": 25, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!param.title && !param.bvid) return response.send(build_response(
        instance, { receive }, "NOT_FOUND_VALID_VALUE", "没有找到有效值：" + 
        "目标参数(Name=TITLE)和目标参数(Name=BVID)至少需一个有值"
    ));

    if (param.bvid && !check_parameter(instance, "bvid", receive, param.bvid, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (param.title && !check_parameter(instance, "title", receive, param.title, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 50 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_platform_title(
            { "bvid": param.bvid, "title": param.title },
            param.count, param.index
        )
    }, "OK"));
});

application.register("/search/:type/by_name", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number, "type": string }}
     */
    const param = Object.assign({
        "count": 25, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "type", receive, param.type, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "type", receive, param.type, "list", {
        "list": [ "uploader", "vocalist", "producer", "synthesizer" ]
    })) return;

    param.type = param.type[0];

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 50 }
    })) return;

    if (!check_parameter(instance, "index", receive, param.index, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    return response.send(build_response(instance, {
        param, receive, "data": search_target_by_name(
            param.type, param.target, param.count, param.index
        )
    }, "OK"));
});

application.use((request, response) => {
    return response.send({
        "code": "NOT_FOUND",
        "time": new Date().toISOString(),
        "status": "failed",
        "target": request.path,
        "message": "目标资源不存在。"
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