import { select } from "./record.js";
import template from "../depend/template.js";
import { quote_string as quote } from "../depend/base.js";

/**
 * 创建新的视图
 * 
 * @param {string} index 新建的视图名称
 * @param {string} table 所属表单
 * @param {object} where 进入视图的条件
 * @param {object} options 构建条件的配置
 * @returns 执行结果
 */
export function create(index, table, where, options) {
    const { flags = [] } = options;

    const parameter = {};
    const statement = [];

    statement.push("CREATE VIEW");

    if (flags.includes("if-not-exists")) {
        statement.push("IF NOT EXISTS");
    }

    const transform = (result) => {
        const { sentence } = result;
        const { parameter } = result;
        
        const _replacer = (_, key) => {
            return parameter[key];
        };

        return sentence.replaceAll(
            /:(Value_\d+)/g, _replacer
        );
    };

    const sentence = template.replace(
        "{{statement}} {{table}} AS {{suffix}}", {
            "table": quote(index, "double"),
            "statement": statement.join(" "),
            "suffix": transform(select.regular(
                table, where, options
            ))
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": parameter
    };
}

/**
 * 删除现有的视图
 * 
 * @param {string} index 需要删除的视图
 * @param {object} options 删除视图时使用的配置
 * @returns 执行结果
 */
export function remove(index, options) {
    const { flags = [] } = options;

    const parameter = {};
    const statement = [];

    statement.push("DROP VIEW");

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
        "parameter": parameter
    };
}