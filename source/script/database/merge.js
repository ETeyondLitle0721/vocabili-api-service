import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import { record } from "../depend/record.js";
import { command_parser } from "../depend/parse.js";
import DatabaseOperator from "../../depend/operator/database.js";

const root = path.resolve(".");
const shell = command_parser(process.argv);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const field = shell.field || "default";

record("merge:database");

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

if (!shell.mode) {
    console.warn("缺少需要合并的模式(mode 参数指明的)");
    console.warn("应用默认的合并模式: 曲目合并模式");

    shell.mode = "song";
}

if (shell.mode === "song") {
    if (!shell.target) {
        console.log("缺少需要合并的目标的识别码列表(target 参数指明的)");
    
        process.exit(1);
    } else {
        shell.target = shell.target.split(" ");
    }
    
    if (!shell.source) {
        console.log("缺少需要基准源的识别码(source 参数指明的)");
    
        process.exit(1);
    }
    
    if (!shell.product) {
        console.log("缺少需要合并后的识别码(product 参数指明的)");
    
        process.exit(1);
    }

    const operator = new DatabaseOperator(instance, (_a, _b, res) => {
        console.log(res);
    });

    console.log("第一步: 克隆基准数据到内存当中");

    const source = operator.select_item("Song_Table", {
        "where": {
            "column": "id",
            "operator": "equal",
            "value": shell.source
        }
    })[0];

    console.log("第二步: 删除需要合并的目标记录信息");

    operator.delete_item("Song_Table", {
        "target": {
            "column": "id",
            "operator": "within",
            "value": shell.target
        }
    });

    console.log("第三步: 将内存中的数据转存到数据库当中");

    operator.insert_item("Song_Table", {
        "target": Object.assign(source, {
            "id": shell.product // 覆盖识别码字段
        })
    });

    console.log("第四步: 替换现有数据为合并后的识别码");

    console.log("第一部分: 处理标记表单中的数据（Mark_Table）");

    operator.update_item("Mark_Table", {
        "target": {
            "column": "target",
            "operator": "within",
            "value": shell.target
        },
        "data": {
            "target": shell.product
        }
    });

    console.log("第二部分: 处理历史榜单数据中的数据（Rank_Table）");

    operator.update_item("Rank_Table", {
        "target": {
            "column": "target",
            "operator": "within",
            "value": shell.target
        },
        "data": {
            "target": shell.product
        }
    });

    console.log("结束: 数据合并完毕");
}