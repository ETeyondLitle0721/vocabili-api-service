import template from "../depend/template.js";
import { quote_string as quote } from "../depend/base.js";

/**
 * 创建新的保存点
 * 
 * @param {string} point 新的保存带点的名称
 * @returns 执行结果
 */
export function create(point) {
    const sentence = template.replace(
        "SAVEPOINT {{point}}", {
            "point": quote(point, "double")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 释放现有的保存点
 * 
 * @param {string} point 需要释放的保存点的名称
 * @returns 执行结果
 */
export function release(point) {
    const sentence = template.replace(
        "ROLLBACK TO SAVEPOINT {{point}}", {
            "point": quote(point, "double")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 回滚到现有保存点
 * 
 * @param {string} point 需要回滚到的保存点的名称
 * @returns 执行结果
 */
export function rollback(point) {
    const sentence = template.replace(
        "ROLLBACK TO SAVEPOINT {{point}}", {
            "point": quote(point, "double")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}