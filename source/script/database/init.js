import fs from "fs"; import path from "path";
import SQLite3 from "better-sqlite3";
import DatabaseOperator from "../../depend/operator/database.js";

const root = path.resolve(".");

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
    "filepath": config.database[field].filepath,
    /** @type { { "table": TableCreateOptions[], "index": IndexCreateOptions[] } } */
    "framework": JSON.parse(
        fs.readFileSync(path.resolve(
            root, config.database[field].framework
        ), "UTF-8")
    )
};

const operator = new DatabaseOperator(
    new SQLite3(database.filepath, {
        "timeout": 1000,
        "readonly": false
    })
);

for (let index = 0; index < database.framework.table.length; index++) {
    const options = database.framework.table[index];

    console.log("正在创建 " + options.name + " 表单");

    operator.create_table(
        options.name, options
    );
}

console.log("所有表单创建完毕");

for (let index = 0; index < database.framework.index.length; index++) {
    const options = database.framework.index[index];

    console.log("正在创建 " + options.name + " 索引");

    operator.create_index(
        options.name, options
    );
}

console.log("所有索引创建完毕");