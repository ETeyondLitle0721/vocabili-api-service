import url from "url";
import path from "path";
import define from "./define/merge.json" with { "type": "json" };
import console from "../../depend/toolkit/console.js";

const root = path.resolve(".");
const __dirname = path.dirname(
    url.fileURLToPath(import.meta.url)
);

console.tlog("定义文件已加载，正在读取目录结构...");

const { input, output } = define;