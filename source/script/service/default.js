import fs from "fs";
import url from "url";
import ansi from "../../depend/utilities/sequence/ansi.js";
import cors from "cors";
import path from "path";
import HTTP from "http";
import express from "express";
import SQLite3 from "better-sqlite3";
import template from "../../depend/utilities/template.js";
import { get_type, text_transformer as capitalize } from "../../depend/core.js";
import DatabaseOperator from "../../depend/operator/database.js";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import { parse_parameter, check_parameter, build_response } from "./depend/default.js";

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
    ),
    "current": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/default.json"
        ), "UTF-8")
    )
};

const field = config.init.field;
const database = {
    /** @type {string} */
    "filepath": config.global.database.filepath[field]
};

const instance = new SQLite3(database.filepath, {
    "timeout": 1000,
    "readonly": false
});

const operator = new DatabaseOperator(instance);
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
    console.log("携带参数:", Object.assign(
        req.query, req.params)
    );

    next();
});

application.get("/get_list/song/by_producer", (request, response) => {
    /**
     * @type {{ "target": string[], "count": number, "page": number }}
     */
    const param = parse_parameter(request);
    const { count = 20, page = 1, target } = param;

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, target, "count", {
        "range": { "maximum": 5 }
    })) return;

    if (!check_parameter(instance, "count", receive, count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 50 }
    })) return;

    if (!check_parameter(instance, "page", receive, page, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;

    if (page === 0) page = 1;

    const result = target.map(value => {
        const result = count !== 0 ? operator.select_item(
            "Mark_Table", {
                "where": [
                    {
                        "column": "type",
                        "operator": "equal",
                        "value": "producer"
                    },
                    {
                        "column": "value",
                        "operator": "within",
                        "value": value
                    }
                ],
                "control": {
                    "result": {
                        "limit": count,
                        "offset": page - 1
                    }
                }
            }
        ) : [];

        return {
            "time": new Date().toISOString(), "page": page,
            "target": value, "result": result, "counter": result.length
        };
    });

    return response.send(build_response(instance, {
        param, receive, "data": result.length === 1 ? result[0] : result
    }, "OK"));
});

application.get("/get_info/song/by_id", (request, response) => {
    /**
     * @type {{ "target": string[] }}
     */
    const param = parse_parameter(request);

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5000 }
    })) return;

    const result = operator.select_item("Song_Table", {
        "where": {
            "column": "id",
            "operator": "within",
            "value": param.target
        }
    });

    return response.send(build_response(instance, {
        param, receive, "data": result.length === 1 ? result[0] : result
    }, "OK"));
});

application.get("/get_info/:type/by_id", (request, response) => {
    /**
     * @type {{ "target": string[], "type": string }}
     */
    const param = parse_parameter(request);

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "type", receive, param.type, "count", {
        "range": { "maximum": 10 }
    })) return;

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5000 }
    })) return;

    const result = [];

    param.type.map(name => {
        if (![ "vocalist", "producer", "uploader", "synthesizer" ].includes(name)) return;

        result.push({
            "type": name,
            "time": new Date().toISOString(),
            "list": operator.select_item(capitalize(name) + "_Table", {
                "where": [
                    {
                        "column": "id",
                        "operator": "within",
                        "value": param.target
                    }
                ]
            })
        });
    });

    return response.send(build_response(instance, {
        param, receive, "data": result.length === 1 ? result[0] : result
    }, "OK"));
});

application.get("/get_mark/by_song", (request, response) => {
    /**
     * @type {{ "target": string[] }}
     */
    const param = parse_parameter(request);

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 500 }
    })) return;

    const result = operator.select_item("Mark_Table", {
        "where": [
            {
                "column": "target",
                "operator": "within",
                "value": param.target
            }
        ]
    });

    return response.send(build_response(instance, {
        param, receive, "data": result
    }, "OK"));
});

application.get("/get_rank/by_song", (request, response) => {
    /**
     * @type {{ "target": string[], "board": string, "issue": number[] }}
     */
    const param = parse_parameter(request);

    let { board: board_list = [], issue: issue_list = [] } = param;

    if (get_type(issue_list).second !== "array") issue_list = [ issue_list ];

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 5 }
    })) return;

    const options = {
        "where": [
            {
                "column": "target",
                "operator": "within",
                "value": param.target
            }
        ]
    };

    if (board_list.length > 0) {
        options.where.push({
            "column": "board",
            "operator": "within",
            "value": param.board
        });
    }

    if (issue_list.length > 0) {
        options.where.push({
            "column": "issue",
            "operator": "within",
            "value": param.issue
        });
    }

    return response.send(build_response(instance, {
        param, receive, "data": operator.select_item(
            "Rank_Table", options
        )
    }, "OK"));
});

application.get("/get_list/meta/board", (request, response) => {
    /**
     * @type {{ "board": string[] }}
     */
    const param = parse_parameter(request);

    const receive = process.uptime(), instance = {
        response, request
    }, result = [];

    if (!check_parameter(instance, "board", receive, param.board || [], "count", {
        "range": { "maximum": 5 }
    })) return;

    param.board.map(board => {
        result.push({
            "time": new Date().toISOString(),
            "board": board,
            "result": config.current.metadata.board[board]
        });
    });

    return response.send(build_response(instance, {
        param, receive, "data": result.length === 1 ? result[0] : result
    }, "OK"));
});

application.get("/get_board/:board/top:top", (request, response) => {
    /**
     * @type {{ "board": string, "top": number, "page": number }}
     */
    const param = parse_parameter(request);
    const { board, top = 100, page = 1 } = param;

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "board", receive, board, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "top", receive, top, "number", {
        "range": { "minimum": 1, "maximum": 500 }
    })) return;

    if (!check_parameter(instance, "page", receive, page, "number", {
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;
    
    const result = operator.select_item("Rank_Table", {
        "where": [
            {
                "column": "board",
                "operator": "equal",
                "value": board
            },
            {
                "column": "rank",
                "operator": ">=",
                "value": top * (page - 1)
            },
            {
                "column": "rank",
                "operator": "<=",
                "value": top * page
            }
        ]
    });

    return response.send(build_response(instance, {
        param, receive, "data": result.slice(
            result.length - top, result.length
        )
    }, "OK"));
});

application.get("/get_board/:board/top:top/by_issue", (request, response) => {
    /**
     * @type {{ "board": string, "top": number, "issue": number[] }}
     */
    const param = parse_parameter(request);

    let { board, top = 100, issue: issue_list = [] } = param;

    if (get_type(issue_list).second !== "array") issue_list = [ issue_list ];

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "board", receive, board, "count", {
        "range": { "maximum": 1 }
    })) return;

    if (!check_parameter(instance, "top", receive, top, "count", {
        "range": { "minimum": 1, "maximum": 10000 }
    })) return;
    
    const result = operator.select_item("Rank_Table", {
        "where": [
            {
                "column": "board",
                "operator": "equal",
                "value": board
            },
            {
                "column": "rank",
                "operator": "<=",
                "value": top
            },
            {
                "column": "issue",
                "operator": "within",
                "value": issue_list
            },
        ]
    });

    return response.send(build_response(instance, {
        param, receive, "data": result
    }, "OK"));
});

application.get("/get_history/by_song", (request, response) => {
    /**
     * @type {{ "target": string[], "count": number, "page": number }}
     */
    const param = Object.assign({
        "count": 20, "page": 1
    }, parse_parameter(request));

    const receive = process.uptime(), instance = {
        response, request
    };

    if (!check_parameter(instance, "target", receive, param.target, "count", {
        "range": { "maximum": 10 }
    })) return;

    if (!check_parameter(instance, "count", receive, param.count, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 200 }
    })) return;

    if (!check_parameter(instance, "page", receive, param.page, "number", {
        "type": "integer",
        "range": { "minimum": 1, "maximum": 131072 }
    })) return;
    
    const result = param.target.map(id => {
        const result = operator.select_item("Snapshot_Table", {
            "where": {
                "column": "target",
                "operator": "equal",
                "value": id
            },
            "control": {
                "result": {
                    "limit": param.count,
                    "offset": param.page - 1
                }
            }
        });

        return {
            "target": id,
            "result": result,
            "counter": result.length
        };
    });

    return response.send(build_response(instance, {
        param, receive, "data": result.length === 1 ? result[0] : result
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