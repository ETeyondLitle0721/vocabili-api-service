import template from "../depend/template.js";

/**
 * 开始一个新事务
 * 
 * @param {options} options 传入的配置
 * @returns 执行结果
 */
export function begin(options) {
    const { type = "default" } = options;

    const mapping = {
        "deferred": "DEFERRED",
        "immediate": "IMMEDIATE",
        "exclusive": "EXCLUSIVE"
    };

    const get_type = (type) => {
        mapping[type] ??= "DEFERRED";

        return mapping[type];
    };

    const sentence = template.replace(
        "BEGIN TRANSACTION {{type}}", {
            "type": get_type(type)
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 提交现有事务
 * 
 * @returns 执行结果
 */
export function commit() {
    const sentence = "COMMIT";

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 回滚现有事务
 * 
 * @returns 执行结果
 */
export function rollback() {
    const sentence = "ROLLBACK";

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}