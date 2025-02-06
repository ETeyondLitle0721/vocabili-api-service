import fs from "fs"; import path from "path"; import HTTP from "http";
import ansi from "../../depend/utilities/sequence/ansi.js"; import cors from "cors";
import express from "express"; import template from "../../depend/utilities/template.js";
import { classification, get_type, text_transformer, unique_array } from "../../depend/core.js";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import { parse_parameter, check_parameter, build_response } from "./depend/default.js";
import {
    get_board_metadata_info_by_board_id as get_board_metadata_info_by_id,
    get_board_song_list, get_mark_info_by_target_id, get_rank_by_song_id,
    get_song_history_info, get_target_info_by_id
} from "./core/service.js";

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
                "text": "(Information)",
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

    console.log(`请求来源: ${req.socket.remoteAddress} (Port=${req.socket.remotePort}, Famliy=${req.socket.remoteFamily})`);
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

    return song.map(song => ({
        "metadata": {
            "id": song.id, "name": song.name, "type": song.type, "target": {
                "vocalist": mark[song.id].vocalist ? mark[song.id].vocalist.map(id => ({
                    "name": target[id].name, "color": target[id].color
                })) : [],
                "producer": mark[song.id].producer.map(id => target[id].name),
                "synthesizer": mark[song.id].vocalist ? mark[song.id].synthesizer.map(id => target[id].name) : []
            }
        }, "platform": (mark[song.id].platform || []).map(id => {
            const info = target[id];

            return {
                "link": info.link.replace("BB://V/", "https://b23.tv/"),
                "publish": info.published_at, "page": info.page, "title": info.title,
                "uploader": uploader[id] ? uploader[id].map(item => target[item.value].name) : [],
                "duration": info.duration, "thumbnail": info.thumbnail.replace("BB://I/", "https://i0.hdslb.com/bfs/archive/"),
                "copyright": info.copyright, "id": id
            };
        })
    }));
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
        })), "metadata": {
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

application.get("/get_current_board_info", (request, response) => {
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

    if (get_board_metadata_info_by_id(param.board)) {
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

application.get("/get_song_info", (request, response) => {
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

application.get("/get_board_info", (request, response) => {
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

application.get("/get_board_metadata_info", (request, response) => {
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

application.get("/get_song_rank_history_info", (request, response) => {
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

application.get("/get_song_count_history_info", (request, response) => {
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

            console.log(`成功在 ${address} 上启用 ${text_transformer(
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