import template from "../depend/template.js";
import { depend as gepend } from "../general.js";
import { quote_string as quote } from "../depend/base.js";

const indent = 4;

/**
 * 创建新的索引
 * 
 * @param {string} table 新建的索引所属的表单
 * @param {string} index 新建的索引名称
 * @param {object} options 新建的索引的配置信息
 * @returns 执行结果
 */
export function create(table, index, options) {
    const { flags = [], column } = options;

    const parameter = {};
        
    const getter = gepend.inner.getter();
    const setter = gepend.inner.setter(parameter);

    const statement = [];

    statement.push("CREATE");

    if (flags.includes("unique")) {
        statement.push("UNIQUE");
    }

    statement.push("INDEX");

    if (flags.includes("if-not-exists")) {
        statement.push("IF NOT EXISTS");
    }

    const column_list = [];

    for (let index = 0; index < column.length; index++) {
        let current = column[index];

        if (typeof current === "string") {
            current = { "name": current };
        }

        const result = [];

        result.push(quote(current.name, "double"));

        if (current.collate) {
            const collate = current.collate.toLowerCase();

            const mapping = {
                "binary": "BINARY", "no-case": "NOCASE"
            };

            const name = mapping[collate] || mapping.binary;

            result.push(`COLLATE ${name}`);
        }

        if (current.order) {
            const order = current.order.toLowerCase();

            const mapping = {
                "asc": "ASC", "desc": "DESC"
            };

            const name = mapping[order] || mapping.asc;

            result.push(name);
        }

        column_list.push(result.join(" "));
    }

    const regex = /:(Value_\d+)/g;

    const replacer = (_, key) => {
        return parameter[key];
    };

    options.where ??= {};
    
    const where = gepend.build.where(
        options.where, setter, getter
    )?.replaceAll(regex, replacer);

    const sentence = template.replace(
        "{{statement}} {{index}} ON {{table}} {{column}}{{where}}", {
            "where": where || "",
            "index": quote(index, "double"),
            "table": quote(table, "double"),
            "column": "(\n" + column_list.map(
                item => " ".repeat(indent) + item
            ).join(",\n") + "\n)",
            "statement": statement.join(" "),
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 删除现有的索引
 * 
 * @param {string} table 索引所属的表单
 * @param {string} index 需要删除的索引
 * @param {object} options 删除索引时使用的配置
 * @returns 执行结果
 */
export function remove(table, index, options) {
    const { flags = [] } = options;

    const statement = [];

    statement.push("DROP INDEX");

    if (flags.includes("if-exists")) {
        statement.push("IF EXISTS");
    }

    const sentence = template.replace(
        "{{statement}} {{index}} ON {{table}}", {
            "table": quote(table, "double"),
            "index": quote(index, "double"),
            "statement": statement.join(" ")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}