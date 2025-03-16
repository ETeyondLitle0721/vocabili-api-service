import fs from "fs";
import path from "path";
import { record } from "./depend/record.js";
import { command_parser } from "./depend/parse.js";

const root = path.resolve(".");
const shell = command_parser(process.argv);

record("start:service", shell);

const config = JSON.parse(
    fs.readFileSync(path.resolve(
        root, "./config.json"
    ), "UTF-8")
);

const service = {
    "define": JSON.parse(
        fs.readFileSync(path.resolve(
            config.service.define
        ), "UTF-8")
    ),
    "target": shell.name || "interface",
};

const target = service.define[service.target];

if (!target) {
    console.log(`无法在定义文件当中找到 ${service.target} 服务的定义信息`);

    process.exit(1);
}

try {
    const { start: script } = target;

    if (!script) {
        console.error("目标服务没有配置启动脚本");

        process.exit(1);
    }

    (await import(
        "file://" + path.resolve(
            root, script
        )
    )).default.start();
} catch (error) {
    console.error("尝试启动服务时出现问题");

    console.error(error);

    throw error;
}