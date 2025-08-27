import path from "path";
import SQLite3 from "better-sqlite3";
import * as bbvid from "../bilibili/identifier.js";
import { split_group } from "../../../depend/toolkit.js";
import { DatabaseOperator } from "../../../depend/database/operator.js";

const root = path.resolve(".");

const filepath = path.resolve(
    root, "./assets/database/platform.db"
);

const instance = new SQLite3(filepath, {
    "timeout": 5000, "readonly": false
});

const operator = new DatabaseOperator(instance);

/**
 * 构造在冲突时修改构建结果的审查函数
 * 
 * @typedef {{ sentence: string }[]} ReviewerList
 * 
 * @param {string} conflict 描述语句
 * @returns {((list: ReviewerList) => ReviewerList)} 审查函数
 */
function on_conflict(conflict) {
    const _reviewer = (result) => {
        return result.map((current) => {
            const { sentence } = current;

            current.sentence = sentence.replace(
                "RETURNING", conflict + " RETURNING"
            );

            return current;
        });
    };

    return _reviewer;
}

const extract = (field) => {
    return (item) => item[field];
};

const MIC = 8192; // 单次插入标识符最大数量

