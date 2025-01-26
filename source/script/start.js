import fs from "fs";
import url from "url";
import path from "path";
import { start_service } from "./service/default.js";

const root = path.resolve(".");
// const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    )
};

start_service(config.global.service.default);