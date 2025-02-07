import fs from "fs"; import path from "path";
import { command_parser } from "./depend/parse.js";

const root = path.resolve(".");
const shell = command_parser(process.argv);

const config = JSON.parse(
    fs.readFileSync(path.resolve(
        root, "./config.json"
    ), "UTF-8")
), service_index = JSON.parse(
    fs.readFileSync(path.resolve(
        config.service.index
    ), "UTF-8")
), service_name = shell.service || "interface";

const service = {
    "name": service_name,
    "config": service_index[service_name]
};

if (!service.config) {
    console.log(`无法在定义文件当中找到 ${service_name} 服务的定义信息`);

    process.exit(1);
}

try {
    const { name = "start", script } = service.config;

    (await import(
        "file://" + path.resolve(
            root, script
        )
    )).default[name]();
} catch (error) {
    console.error("尝试启动服务时出现问题");

    throw error;
}