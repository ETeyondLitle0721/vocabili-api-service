import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import DatabaseOperator from "../../depend/operator/database.js";

const root = path.resolve(".");
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {import("../../depend/operator/database").TableCreateOptions} TableCreateOptions
 */

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    ),
    "current": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/init.json"
        ), "UTF-8")
    )
};

const field = config.current.field;

const database = {
    /** @type {string} */
    "filepath": config.global.database.filepath[field],
    /** @type { { "table": TableCreateOptions[] } } */
    "framework": JSON.parse(
        fs.readFileSync(path.resolve(
            root, config.global.database.framework[field]
        ), "UTF-8")
    )
};

const operator = new DatabaseOperator(
    new SQLite3(database.filepath, {
        "timeout": 1000,
        "readonly": false
    })
);

// console.log(database);

for (let index = 0; index < database.framework.table.length; index++) {
    const options = database.framework.table[index];

    console.log("正在创建 " + options.name + " 表单");

    operator.create_table(
        options.name, options
    );
}

console.log("所有表单创建完毕");