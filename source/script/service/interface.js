import fs from "fs";
import url from "url";
import cors from "cors";
import path from "path";
import ansi from "../../depend/utilities/sequence/ansi.js";
import express from "express";
import template from "../../depend/utilities/template.js";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import {
    to_string,
    text_transformer as capitalize
} from "../../depend/core.js";
import {
    parse_parameter, check_parameter, build_response
} from "./core/depend.js";
import {
    close,
    get_song_info_by_id,
    get_song_list_by_pool_id,
    get_song_list_by_mark,
    get_target_list_by_type,
    get_board_entry_info,
    get_latest_board_entry_info,
    get_board_metadata_by_id,
    get_song_rank_history_info_by_id,
    get_platform_count_history_by_id,
    search_target_by_name,
    search_song_by_name,
    search_song_by_title,
    search_song_by_filter,
    get_target_by_id
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

const app = express();

const service = config.service.options[field];

if (service.cors) {
    app.use(cors(
        service.cors
    ));
}

/**
 * 注册不同方法的路由
 * 
 * @param {string} router 路由定义字符串
 * @param {Parameters<typeof app.post>[1]} handler 处理方法
 * @param {("get"|"post")[]} method 需要注册的方法
 * @returns 方法返回值
 */
app.register = (
    router, handler, method = [ "get", "post" ]
) => {
    return method.forEach(method => {
        return app[method](router, handler);
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

app.use((req, res, next) => {
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

    /**
     * 检查一个字段是否符合规则
     * 
     * @param {string} field 字段名称
     * @param {object} rule 字段值规则
     * @param {string[]} value 字段值
     * @returns {boolean} 是否符合规则
     */
    function _check(field, rule, value) {
        if (value && rule.mode !== "count") {
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

/**
 * 解析参数并添加默认值
 * 
 * @param {Express.Request} request 
 */
function parse_param(request, source = {}) {
    source = Object.fromEntries(Object.entries(source).map(
        ([key, value]) => ([ key, [ to_string(value) ] ])
    ));

    return Object.assign(
        source, parse_parameter(request)
    );
}

app.register("/info/song", (request, response) => {
    /**
     * @type {{ "target": string[] }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    return response.send(build_response(instance, {
        param, receive, "data": get_song_info_by_id(param.target)
    }, "OK"));
});

app.register("/list/song/by_:type", (request, response) => {
    /**
     * @type {{ "type": ("pool"|"uploader"|"vocalist"|"producer"|"synthesizer"), "count": number, "index": number, "target": string }}
     */
    const param = parse_param(request, {
        "count": 50, "index": 1
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    if (param.type === "pool") {
        return response.send(build_response(instance, {
            param, receive, "data": get_song_list_by_pool_id(
                param.target, +param.count, +param.index
            )
        }, "OK"));
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_song_list_by_mark(
            param.type, param.target, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/list/:type", (request, response) => {
    /**
     * @type {{ "type": ("song"|"board"|"uploader"|"vocalist"|"producer"|"synthesizer"), "count": number, "index": number }}
     */
    const param = parse_param(request, {
        "count": 20, "index": 1
    }), receive = process.uptime();
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

app.register("/info/board", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number,
     *  "issue": number, "part": string, "field": string }}
     */
    const param = parse_param(request, {
        "count": 50, "index": 1, "part": "main", "field": "point.total"
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        if (key !== "issue") {
            param[key] = value[0];
        }
    }

    const metadata = get_board_metadata_by_id(param.board);

    if (!metadata) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    const target = param.issue.map(
        issue => metadata.catalog.find(
            item => item.issue === +issue
        )
    );

    for (const current of target) {
        if (!current) {
            return response.send(
                build_response(instance, {
                    param, receive
                }, "ISSUE_NOT_EXISTS")
            );
        }

        if (!current.part[param.part]) {
            return response.send(
                build_response(instance, {
                    param, receive 
                }, "PART_NO_EXISTS")
            );
        }
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_board_entry_info(
            param.issue, param.board, +param.count,
            +param.index, param.part, param.field
        )
    }, "OK"));
});

app.register("/info/board/_latest", (request, response) => {
    /**
     * @type {{ "board": string, "count": number,
     *  "index": number, "part": string, "field": string }}
     */
    const param = parse_param(request, {
        "count": 50, "index": 1, "part": "main", "field": "point.total"
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_by_id(param.board);

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
        param, receive, "data": get_latest_board_entry_info(
            param.board, +param.count, +param.index,
            param.part, param.field
        )
    }, "OK"));
});

app.register("/metadata/board", (request, response) => {
    /**
     * @type {{ "target": string  }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_by_id(param.target);

    if (!metadata) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    return response.send(build_response(instance, {
        param, receive, "data": metadata
    }, "OK"));
});

app.register("/metadata/board/issue", (request, response) => {
    /**
     * @type {{ "board": string, "issue": number }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_by_id(param.board);

    if (!metadata) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    if (!metadata) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    const target = metadata.catalog.find(
        item => item.issue === +param.issue
    );

    if (!target) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "ISSUE_NOT_EXISTS")
        );
    }

    return response.send(build_response(instance, {
        param, receive, "data": target
    }, "OK"));
});

app.register("/metadata/board/part", (request, response) => {
    /**
     * @type {{ "board": string, "issue": number, "part": string }}
     */
    const param = parse_param(request, {
        "part": "main"
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_by_id(param.board);

    if (!metadata) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    const target = metadata.catalog.find(
        item => item.issue === +param.issue
    );

    if (!target.part[param.part]) {
        return response.send(
            build_response(instance, {
                param, receive 
            }, "PART_NO_EXISTS")
        );
    }

    return response.send(build_response(instance, {
        param, receive, "data": target.part[param.part]
    }, "OK"));
});

app.register("/history/song/rank", (request, response) => {
    /**
     * @type {{ "board": string, "count": number, "index": number, "part": string, "issue": number[], "target": string, "sort": ("newest"|"oldest") }}
     */
    const param = Object.assign({
        "issue": []
    }, parse_param(request, {
        "count": 50, "index": 1, "sort": "newest", "part": "main"
    })), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        if (key !== "issue") {
            param[key] = value[0];
        }
    }

    if (!get_board_metadata_by_id(param.board)) {
        return response.send(
            build_response(instance, {
                param, receive
            }, "BOARD_NOT_EXISTS")
        );
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_song_rank_history_info_by_id(
            param.target, param.issue.map(item => parseFloat(item)),
            param.sort, param.board, param.part, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/history/platform/count", (request, response) => {
    /**
     * @type {{ "count": number, "index": number, "target": string, "sort": ("newest"|"oldest") }}
     */
    const param = parse_param(request, {
        "count": 20, "index": 1, "sort": "newest"
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": get_platform_count_history_by_id(
            param.target, param.sort, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/search/song/by_name", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number, "threshold": number }}
     */
    const param = parse_param(request, {
        "count": 25, "index": 1, "threshold": 0.2
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_name(
            param.target, +param.threshold, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/search/song/by_title", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number, "threshold": number }}
     */
    const param = parse_param(request, {
        "count": 25, "index": 1, "threshold": 0.2
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_title(
            param.target, +param.threshold, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/search/song/by_filter", (request, response) => {
    /**
     * @type {{ "count": number, "index": number }}
     */
    const param = parse_param(request, {
        "count": 25, "index": 1, "order": "asc", "sort": "default"
    }), receive = process.uptime();
    const instance = { response, request };

    // 此处仅实现了 "count" 和 "index" 以及 "order" 和 "sort" 的检查
    if (!check_param(param, receive, instance)) return;

    const filter = {};

    for (const [ field, value ] of Object.entries(param)) {
        if ([
            "vocalist", "producer", "keywords", "uploader", "synthesizer"
        ].includes(field)) {
            filter[field] = value;
        }

        if ([ "copyright", "type" ].includes(field)) {
            if (!check_parameter(
                instance, field, receive,value, "count", {
                    "range": { "maximum": 1 }
                }
            )) return;

            filter[field] = value[0];
        }

        if (field.startsWith("publish")) {
            if (!check_parameter(
                instance, field, receive, value[0], "date"
            )) return;

            filter[field] = new Date(value[0]);
        }
    }

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_song_by_filter(
            filter, param.sort, param.order, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/search/:type/by_name", (request, response) => {
    /**
     * @type {{ "target": string, "count": number, "index": number, "threshold": number }}
     */
    const param = parse_param(request, {
        "count": 25, "index": 1, "threshold": 0.2
    }), receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    return response.send(build_response(instance, {
        param, receive, "data": search_target_by_name(
            param.type, param.target, +param.threshold, +param.count, +param.index
        )
    }, "OK"));
});

app.register("/check/exist/board", (request, response) => {
    /**
     * @type {{ "board": string }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    const metadata = get_board_metadata_by_id(param.board);

    return response.send(build_response(instance, {
        param, receive, "data": !!metadata
    }, "OK"));
});

app.register("/check/exist/board/issue", (request, response) => {
    /**
     * @type {{ "board": string, "issue": number }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    let result = false;

    const metadata = get_board_metadata_by_id(param.board);

    if (metadata) {
        metadata.catalog.forEach(item => {
            if (item.issue === +param.issue) {
                result = true;
            }
        });
    }

    return response.send(build_response(instance, {
        param, receive, "data": result
    }, "OK"));
});

app.register("/check/exist/board/part", (request, response) => {
    /**
     * @type {{ "board": string, "issue": number, "part": string }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    for (const [ key, value ] of Object.entries(param)) {
        param[key] = value[0];
    }

    let result = false;

    const metadata = get_board_metadata_by_id(param.board);

    if (metadata) {
        metadata.catalog.forEach(item => {
            if (item.issue === +param.issue) {
                if (item.part[param.part]) {
                    result = true;
                }
            }
        });
    }

    return response.send(build_response(instance, {
        param, receive, "data": result
    }, "OK"));
});

app.register("/info/:type", (request, response) => {
    /**
     * @type {{ "target": string[] }}
     */
    const param = parse_param(request);
    const receive = process.uptime();
    const instance = { response, request };

    if (!check_param(param, receive, instance)) return;

    return response.send(build_response(instance, {
        param, receive, "data": get_target_by_id(
            param.type || "song", param.target
        )
    }, "OK"));
});

app.use((request, response) => {
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
    const address = `http://${service.host}:${service.port}/`;

    const server = app.listen(
        service.port, service.host, (error) => {
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

function exit() {
    close();

    process.exit(1);
}

process.on("exit", exit);
process.on("SIGINT", exit);
process.on("SIGTERM", exit);
process.on("uncaughtException", exit);
process.on("unhandledRejection", exit);