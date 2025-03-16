import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import * as updater from "./depnd/update.js";
import { record } from "../depend/record.js";
import { command_parser } from "../depend/parse.js";
import { close, get_song_info_by_id } from "../service/core/interface.js";

const root = path.resolve(".");
const shell = command_parser(process.argv);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

record("catalog:database");

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

/**
 * 克隆时间对象
 */
Date.prototype.clone = function () {
    const result = new Date(this.getTime());

    result.setHours(0, 0, 0, 0);

    return result;
};


/**
 * 获取接下来的时间节点
 * 
 * @param {("day"|"week"|"month")} unit 步长单位
 * @param {number} amount 步长数值
 * @returns {Date} 接下来的时间节点
 */
Date.prototype.getNextDate = function (unit, amount = 1) {
    const instance = this.clone();

    if (unit === "day") instance.setDate(instance.getDate() + amount);
    if (unit === "week") instance.setDate(instance.getDate() + amount * 7);
    if (unit === "month") instance.setMonth(instance.getMonth() + amount);

    return instance;
};

/**
 * 获取 YYYY-MM-DD 格式的时间字符串
 * 
 * @returns {string} 转换出来的符合格式的时间字符串
 */
Date.prototype.toDateString = function () {
    const day = String(this.getDate()).padStart(2, "0");
    const year = this.getFullYear();
    const month = String(this.getMonth() + 1).padStart(2, "0");
    
    return `${year}-${month}-${day}`;
};

/**
 * 根据标准信息和打表范围生成列表
 * 
 * @param {{ "mode": ("weekly"|"daily"|"monthly"), "date": string, "issue": number }} standard 基准
 * @param {[ Date, Date ]} range 打表范围
 * @returns { { "issue": number, "range": { "start": string, "finish": string } }[] } 打表结果
 */
function lister(standard, range) {
    const [ start, finish ] = range.map(date => date.clone());
    const { mode, date, issue } = standard, result = [];

    const unit = {
        "weekly": "week",
        "monthly": "month",
        "daily": "day"
    } [ mode ] || "day";

    // 向前搜索
    let offset_backward = 0, backward_date = new Date(date).clone();

    while (backward_date >= start) {
        const finish_date = backward_date.clone();
        const start_date = finish_date.getNextDate(unit, -1);

        const range_start = start_date < start ? start : start_date;
        const range_finish = finish_date > finish ? finish.clone() : finish_date;

        result.push({
            "issue": issue + offset_backward, "range": {
                "start": range_start.toDateString(),
                "finish": range_finish.toDateString()
            }
        });

        backward_date = start_date.clone(), offset_backward--;
    }

    // 向后搜索
    let offset_forward = 1, forward_date = new Date(date).clone();

    while (forward_date < finish) {
        const start_date = forward_date.clone();
        const finish_date = start_date.getNextDate(unit, 1);

        const range_start = start_date < start ? start.clone() : start_date;
        const range_finish = finish_date > finish ? finish.clone() : finish_date;

        result.push({
            "issue": issue + offset_forward, "range": {
                "start": range_start.toDateString(),
                "finish": range_finish.toDateString()
            }
        });

        forward_date = new Date(finish_date.getTime()), offset_forward++;
    }

    return result.sort((a, b) => a.issue - b.issue);
}

const memory = {
    "issue": new Map()
};

const filepath = {
    "define": path.resolve(
        __dirname, "../service/define/default.json"
    ),
    "collate": path.resolve(
        __dirname, "./define/collate.json"
    )
};

const database = {
    "path": config.global.database[field].path
};

const instance = new SQLite3(database.path, { 
    "timeout": 1000, "readonly": false
});

const { standard, special } = config.manifest;

if (standard) {
    const entries = Object.entries(standard);

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index], result = lister(entry[1], [
            new Date("2024-06-23"), new Date()
        ]);
        
        memory.issue.set(entry[0], Object.assign(
            Object.fromEntries(
                result.map(item => ([
                    item.range.finish, item.issue
                ]))
            ), Object.fromEntries(
                result.map(item => ([
                    item.issue, item.range.finish
                ]))
            )
        ));
    }
}

updater.define(instance, filepath.define, {
    "get_song_info": get_song_info_by_id
}, memory, special);

close();
process.exit(0);