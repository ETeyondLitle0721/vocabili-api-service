import { repair_character as repair } from "../core.js";

/**
 * @typedef SpecialTableItem
 * @property {"N/A"} _invalid 当无法在参数映射表中寻找到对应字段的时候所展示的数值
 * 
 * @typedef {(Object<string, (number|string|boolean)> & SpecialTableItem)} ReplaceTable
 * 
 * @typedef ReplaceParameter
 * @property {string} field 字段名称
 * @property {string} value 替换值
 * @property {number} length 期望长度
 * @property {string} filler 补位字符
 * @property {("start"|"end")} direction 补位方向
 * 
 * @callback ReplacerCallback
 * @param {ReplaceTable} table 参数映射表
 * @param {RegExpExecArray} match 匹配结果
 * @param {number} index 匹配到的索引值
 * 
 * @returns {string} 替换值
 */

const regex = {
    "match": /{{(.*?)}}/g,
    "split": /\s*,\s*/
};

/**
 * 用于根据参数值给出替换结果的方法
 * 
 * 格式：{{字段名称, 期望长度, 补位字符}}
 * - 字段名称：引用的值在 replacer 之中的名称
 * - 期望长度：期望的对应的字段的数值转换成字符串之后的的期望长度，如果为正整数就是正向补在头部，如果为负整数就是补在末尾
 * - 补位字符：不满足期望长度时的补位字符（推荐为一个字符）
 * 
 * @param {ReplaceTable} table 参数映射表
 * @param {RegExpExecArray} match 匹配结果
 * @param {number} index 匹配到的索引值
 * 
 * @returns {string} 替换值
 */
function _replacer(table, match, index) {
    let value = table._invalid || "N/A", parameter = match[1].split(/\s*,\s*/),
        field = parameter[0];

    if (!table[field]) {
        field = Object.keys(table)[index];
    }

    let length = parseInt(parameter[1]) || 1,
        scheme = length >= 0 ? "padStart" : "padEnd",
        placeholder = parameter[2] ?? " ";

    if (field in table) {
        value = table[field].toString()[scheme](
            Math.abs(length), placeholder
        );
    }1

    return value;
}

/**
 * 用于根据参数值给出替换结果的方法
 * 
 * 格式：{{字段名称, 期望长度, 补位字符}}
 * - 字段名称：引用的值在 replacer 之中的名称
 * - 期望长度：期望的对应的字段的数值转换成字符串之后的的期望长度，如果为正整数就是正向补在头部，如果为负整数就是补在末尾
 * - 补位字符：不满足期望长度时的补位字符（推荐为一个字符）
 * 
 * @param {string} before 经过替换之后的字符串
 * @param {string} after 没有替换之前的字符串
 * @param {RegExpExecArray} match 匹配到的未经替换的部分
 * @param {number} index 匹配到的索引值
 * 
 * @returns {ReplaceParameter} 替换值
 */
function _parser(before, after, match, index) {
    let suffix = after.slice(match.index + match[0].length),
        parameter = match[1].split(regex.split),
        expression = after.slice(0, match.index) + "(.*)" + (suffix ? suffix : "");

    expression = expression.replaceAll(regex.match, ".*");

    let regexp = new RegExp(expression),
        length = Number(parameter[1]) || 1,
        filler = parameter[2] || " ",
        value = before.match(regexp)[1] ?? null;

    if (length > 0) {
        value = value.replace(new RegExp(`^(${filler}){1,}`, "g"))
    } else if (length < 0) {
        value = value.replace(new RegExp(`(${filler}){1,}$`, "g"))
    }

    return {
        "field": parameter[0] || "Index-" + repair(index, 4, "0"),
        "value": value,
        "filler": filler,
        "length": Math.abs(length),
        "direction": length >= 0 ? "start" : "end",
    };
}

/**
 * 格式化包含插值表达式的字符串为对应的数值
 * 
 * @param {string} expression 包含插值表达式的字符串
 * @param {(Object<string, any>|ReplaceTable)} config 配置参数
 * @param {ReplacerCallback} replacer 回调方法
 * 
 * @returns {string} 经过格式化之后的字符串
 */
export function replace(expression, config, replacer = _replacer) {
    let match = expression.matchAll(regex.match);

    if (match) {
        let list = Array.from(match);

        for (let index = 0; index < list.length; index++) {
            let current = list[index];

            expression = expression.replace(
                current[0], replacer(
                    config, current, index
                )
            );
        }
    }

    return expression;
}

/**
 * 通过替换前后的字符串解析出相关参数的原始信息
 * 
 * @param {string} before 经过替换之后的字符串
 * @param {string} after 没有替换之前的字符串
 * 
 * @returns {Object<string, (Object<string, any>|ReplaceParameter)>} 解析出的相关参数的原始信息
 */
export function parse(before, after, parser = _parser) {
    let result = {}, match = after.matchAll(regex.match);

    if (match) {
        let list = Array.from(match);

        for (let index = 0; index < list.length; index++) {
            let { field, ...parameter } = parser(
                before, after, list[index], index
            );

            result[field] = parameter;
        }
    }

    return result;
}

export default {
    parse, replace
};