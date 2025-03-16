import fs from "fs";
import path from "path";
import SQLite3 from "better-sqlite3";
import { record } from "./depnd/record.js";
import DatabaseOperator from "../../depend/operator/database.js";

const root = path.resolve(".");

record("init:database");

/**
 * @typedef {import("../../depend/operator/database.js").TableCreateOptions} TableCreateOptions
 * @typedef {import("../../depend/operator/database.js").IndexCreateOptions} IndexCreateOptions
 */

const config = JSON.parse(
    fs.readFileSync(path.resolve(
        root, "./config.json"
    ), "UTF-8")
);

const field = process.argv[2] || "default";

const database = {
    /** @type {string} */
    "path": config.database[field].path,
    /** @type { { "table": TableCreateOptions[], "index": IndexCreateOptions[] } } */
    "schema": JSON.parse(
        fs.readFileSync(path.resolve(
            root, config.database[field].schema
        ), "UTF-8")
    )
};

const operator = new DatabaseOperator(
    new SQLite3(database.path, {
        "timeout": 1000,
        "readonly": false
    })
);

const { table: tables, index: indexes } = database.schema;

for (let index = 0; index < tables.length; index++) {
    const options = tables[index];

    console.log("正在创建名称为 " + options.name + " 的表单");

    operator.create_table(
        options.name, options
    );
}

console.log("所有表单创建完毕");

for (let index = 0; index < indexes.length; index++) {
    const options = indexes[index];

    console.log("正在创建名称为 " + options.name + " 的索引");

    operator.create_index(
        options.name, options
    );
}

console.log("所有索引创建完毕");