import fs from "fs"; import path from "path"; import HTTP from "http";
import ansi from "../../depend/utilities/sequence/ansi.js"; import cors from "cors";
import express from "express"; import template from "../../depend/utilities/template.js";
import { text_transformer } from "../../depend/core.js";
import format_datetime, { datetime } from "../../depend/toolkit/formatter/datetime.js";
import { parse_parameter } from "./depend/default.js";

const root = path.resolve(".");

const config = JSON.parse(
    fs.readFileSync(path.resolve(
        root, "./config.json"
    ), "UTF-8")
), field = "website";

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

application.use(express.static(
    path.resolve(
        root, service_config.public
    )
));

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
                throw new Error(`在 ${address} 上启用 ${text_transformer(
                    field, 1, (text) => text.toUpperCase()
                )} 服务时遇到错误：`, {
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