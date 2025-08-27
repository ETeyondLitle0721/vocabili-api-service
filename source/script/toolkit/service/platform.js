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

const MIC = 8192; // 单次插入标识符最大数量

