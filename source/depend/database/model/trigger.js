import template from "../depend/template.js";
import { quote_string as quote } from "../depend/base.js";

/**
 * 创建新的触发器
 * 
 * @param {string} index 新建的触发器名称
 * @param {object} options 新建的触发器的配置信息
 * @returns 执行结果
 */
export function create(index, options) {

}

/**
 * 删除现有的触发器
 * 
 * @param {string} index 需要删除的触发器
 * @param {object} options 删除触发器时使用的配置
 * @returns 执行结果
 */
export function remove(index, options) {
    const { flags = [] } = options;

    const statement = [];

    statement.push("DROP TRIGGER");

    if (flags.includes("if-exists")) {
        statement.push("IF EXISTS");
    }

    const sentence = template.replace(
        "{{statement}} {{table}}", {
            "table": quote(index, "double"),
            "statement": statement.join(" ")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}