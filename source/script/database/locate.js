import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import { record } from "../depend/record.js";
import { command_parser } from "../depend/parse.js";

const root = path.resolve(".");
const shell = command_parser(process.argv);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const field = shell.field || "default";

record("locate:database");

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    ),
    "manifest": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/insert.json"
        ), "UTF-8")
    )
};

const database = {
    "path": config.global.database[field].path
};

const instance = new SQLite3(database.path, { 
    "timeout": 1000, "readonly": false
});

if (shell.mode === "mark") {
    const target = shell.target;

    const iterator = instance.prepare(
        `SELECT * FROM Mark_Table WHERE value = :value;`
    ).iterate({    
        "value": target
    });

    // 只有在按下 enter 之后才会加载下一个结果

    console.log("按下 Enter 尝试加载结果");

    process.stdin.on("data", () => {
        const result = iterator.next();

        if (result.done) {
            console.log("数据全部加载完毕");

            process.exit(0);
        } else {
            console.log(result.value);
        }
    });
}