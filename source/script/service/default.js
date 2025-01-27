import fs from "fs";
import url from "url";
import ansi from "../../depend/utilities/sequence/ansi.js";
import cors from "cors";
import path from "path";
import HTTP from "http";
import express from "express";
import template from "../../depend/utilities/template.js";
import { classification, get_type, unique_array } from "../../depend/core.js";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import { parse_parameter, check_parameter, build_response } from "./depend/default.js";
import { get_board_metadata_info_by_board_id, get_board_song_list, get_mark_info_by_song_id, get_rank_by_song_id, get_song_history_info, get_target_info_by_id } from "./interface.js";

const root = path.resolve(".");
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {import("../../depend/operator/database.js").GeneralObject} GeneralObject
 */

const config = {
    "init": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "../database/define/init.json"
        ))
    ),
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    )
};

const application = express();

application.use(cors(
    config.global.cors
));

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
            get_mark_info_by_song_id(list), (value) => {
                return value.target;
            }
        )
    ).map(([key, value]) => ([
        key, Object.fromEntries(Object.entries(
            classification(value, (value) => value.type)
        ).map(([key, value]) => ([
            key, unique_array(value.map(item => item.value))
        ])))
    ])));

    const target = Object.fromEntries(
        get_target_info_by_id(
            [ "producer", "uploader", "vocalist", "synthesizer" ],
            Object.values(mark).flat().map(item => Object.values(item)).flat(2)
        ).map(item => item.response).flat().map(item => ([
            item.id, item
        ]))
    );

    return song.map(song => ({
        "metadata": {
            "id": song.id.replace("Song:", ""),
            "name": song.name,
            "type": song.type,
            "target": {
                "uploader": mark[song.id].producer.map(id => target[id].name),
                "vocalist": mark[song.id].vocalist.map(id => ({
                    "name": target[id].name, "color": target[id].color
                })),
                "producer": mark[song.id].producer.map(id => target[id].name),
                "synthesizer": mark[song.id].synthesizer.map(id => target[id].name)
            }
        },
        "platform": {
            "link": song.link,
            "page": song.page,
            "title": song.title,
            "cover": song.cover,
            "length": song.duration,
            "upload": song.uploaded_at
        },
        "copyright": song.copyright
    }));
}

/**
 * 获取排行榜数据
 * 
 * @param {number} issue 需要获取数据的期数
 * @param {("vocaloid-weekly"|"voclaoid-daily")} board 需要获取的排行榜
 * @param {number} count 要获取多少个
 * @param {number} index 页索引
 * @returns 获取到的排行榜信息
 */
function board_info(issue, board = "vocaoid-weekly", count = 50, index = 1) {
    const list = get_board_song_list({
        issue, count, index, board
    }), metadata = get_board_metadata_info_by_board_id(board);

    const song_id_list = list.map(item => item.target);

    const target = song_info(song_id_list), result = {
        "board": list.map((song, index) => ({
            "rank": {
                "view": song.view_rank,
                "like": song.like_rank,
                "coin": song.coin_rank,
                "board": song.rank,
                "favorite": song.favorite_rank
            },
            "count": {
                "view": song.view,
                "like": song.like,
                "coin": song.coin,
                "point": song.point,
                "board": song.count,
                "favorite": song.favorite
            },
            "target": target[index]
        })),
        "metadata": {
            "id": get_type(board).second === "array" ? board[0] : board,
            "name": metadata.name,
            "issue": issue
        }
    };

    get_rank_by_song_id({
        board, "count": count, "issue": [ metadata.list.issue.default[
            metadata.list.issue.default.indexOf(issue) - 1
        ] ], "target": song_id_list
    }).map(last => (result.board[song_id_list.indexOf(last.target)].list = {
        "rank": {
            "view": last.view_rank,
            "like": last.like_rank,
            "coin": last.coin_rank,
            "board": last.rank,
            "favorite": last.favorite_rank
        },
        "count": {
            "view": last.view,
            "like": last.like,
            "coin": last.coin,
            "point": last.point,
            "favorite": last.favorite
        },
        "target": last.target.replace("Song:", "")
    }));

    return result;
}

/**
 * 获取最新的排行榜
 * 
 * @param {("vocaloid-weekly"|"voclaoid-daily")} board 需要获取的排行榜
 * @param {number} count 要获取多少个
 * @param {number} index 当前的页数
 * @returns 获取到的排行榜信息
 */
function current_board_info(board = "vocaoid-weekly", count = 50, index = 1) {
    const metadata = get_board_metadata_info_by_board_id(board);

    return board_info(
        metadata.list.issue.default.at(-1), board, count, index
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
        "date": item.recorded_at,
        "count": {
            "view": item.view, "like": item.like,
            "coin": item.coin, "favorite": item.favorite
        }
    }));
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
            "view": item.view, "like": item.like, "board": item.rank,
            "coin": item.coin, "favorite": item.favorite
        },
        "count": {
            "view": item.view, "like": item.like, "point": item.point,
            "coin": item.coin, "favorite": item.favorite
        }, "issue": item.issue, "board": item.board,
        "target": item.target
    }));
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

    if (get_board_metadata_info_by_board_id(param.board)) {
        return response.send(build_response(instance, {
            param, receive, "data": current_board_info(
                param.board, param.count, param.index
            )
        }, "OK"));
    }

    return response.send(build_response(instance, {
        param, receive, "data": null
    }, "BOARD_NOT_EXISTS", "目标榜单不存在"));
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

    if (!check_parameter(instance, "issue", receive, param.issue, "count", {
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

    return response.send(build_response(instance, {
        param, receive, "data": board_info(
            param.issue, param.board, param.count, param.index
        )
    }, "OK"));
});

application.get("/get_board_metadata_info", (request, response) => {
    /**
     * @type {{ "target": string }}
     */
    const param = parse_parameter(request);
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (get_board_metadata_info_by_board_id(param.target[0])) {
        return response.send(build_response(instance, {
            param, receive, "data": get_board_metadata_info_by_board_id(param.target[0])
        }, "OK"));
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

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 200 }
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
        "count": 50, "index": 1
    }, parse_parameter(request));
    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5 }
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
 * @param {object} config 服务器配置
 * @returns {HTTP.Server} 监听指定配置的 HTTP Server 实例化对象
 */
export function start_service(config = {}) {
    const address = `http://${config.host}:${config.port}/`;

    const server = application.listen(
        config.port, config.host, (error) => {
            if (error) {
                throw new Error(`在 ${address} 上启用 Default 服务时遇到错误：`, {
                    "cause": "服务提供器监听指定端口失败",
                    "error": error
                });
            }

            console.log(`成功在 ${address} 上启用 Default 服务`);
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