import { get_date_info } from "../utilities/datetime.js";
import { replace as interpolator } from "./template.js";
import { repair_character as repair } from "../toolkit.js";
``
const nickname = {
    "year": "y", "week": "w", "day": "d", "hour": "h", "month": [],
    "minute": [ "m", "min" ], "second": [ "s", "sec" ],
    "millisecond": "ms", "microsecond": "us", "nanosecond": "ns",
    "timestamp": "ts", "timezone": [ "tz", "zone" ],
    "week_number": "wn"
}, nickname_mapping = {};

Object.entries(nickname).map((item) => ([
    item[1], item[0], item[0] + "s"
]).flat().map((key) => {
    nickname_mapping[key] = item[0];
}));

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
 * 
 * @returns {string} 替换值
 */
function replacer(table, match) {
    let value = table._invalid ?? "N/A",
        parameter = match[1].split(/\s*,\s*/);

    let field = nickname_mapping[parameter[0]] ?? parameter[0];

    if (table[field] !== undefined) {
        let length = parseInt(parameter[1]) || 1;

        length ??= { "year": 4, "millisecond": 3 }[ field ] || 2;

        if (field === "week") {
            table[field] = "星期" + {
                "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "日"
            } [ table[field] ];
        }

        value = repair(
            table[field].toString(),
            length,
            parameter[2] ?? "0",
            length >= 0 ? "start" : "end"
        );
    };

    return value;
}

/**
 * 通过给定的时间戳依据给定的格式格式化时间
 * 
 * 时间单元格式：{{字段名称, 期望长度, 补位字符}}
 * - 字段名称：引用的数值所处的字段的名称
 * - 期望长度：期望的对应的字段的数值转换成字符串之后的的期望长度，如果为正整数就是正向补在头部，如果为负整数就是补在末尾
 * - 补位字符：不满足期望长度时的补位字符（推荐为一个字符）
 * 
 * @param {string} expression 内容表达式
 * @param {Date} date 用于格式化的 Date 实例化对象
 * @param {ReplaceTable} extra 附加的替换表
 * @returns {string} 格式化后的时间
 */
export function format(expression, date = new Date(), extra) {
    const table = Object.assign(
        get_date_info(date), extra
    );

    return interpolator(
        expression, table, replacer
    );
}

export const datetime = {
    "tz": "{{timezone}}",
    "date": "{{year, 4}}-{{month, 2}}-{{day, 2}}",
    "time": "{{hour, 2}}:{{minute, 2}}:{{second, 2}}.{{millisecond, 3}}",
    "format": "{{timezone}} {{year, 4}}-{{month, 2}}-{{day, 2}} {{hour, 2}}:{{minute, 2}}:{{second, 2}}.{{millisecond, 3}}"
};