import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import { command_parser } from "../depend/parse.js";

const root = path.resolve(".");
const shell = command_parser(process.argv);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const field = shell.field || "default";

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

const result = instance.prepare(`
    SELECT value, COUNT(*) AS count
    FROM Mark_Table
    GROUP BY value
`).all().map(item => item.value);

const target = [
    "Uploader_Table",
    "Platform_Table",
    "Vocalist_Table",
    "Producer_Table",
    "Synthesizer_Table"
];

target.forEach(table => {
    console.log(`开始审查 ${table} 表单`);

    const iterator = instance.prepare(`SELECT * FROM ${table}`).iterate();

    const target = [];

    for (const row of iterator) {
        if (!result.includes(row.id)) {
            target.push(row.id);

            console.log(row, "没有被引用过");
        }
    }

    if (target.length > 0) {
        console.log(`准备删除 ${target.length} 条数据`);

        const statement = instance.prepare(`
            DELETE FROM ${table} WHERE id = ?
        `);

        target.forEach(id => {
            statement.run(id);
        });

        console.log(`已删除 ${target.length} 条数据`);
    } else {
        console.log(`没有需要删除的数据`);
    }
});