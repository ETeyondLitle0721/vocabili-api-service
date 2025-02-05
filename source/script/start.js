import fs from "fs"; import path from "path";
import { start_service } from "./service/default.js";

const root = path.resolve(".");

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    )
};

start_service(config.global.service.default);