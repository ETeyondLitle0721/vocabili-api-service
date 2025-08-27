import { replace as interpolator } from "./template.js";
import { deep_clone, repair_character as repair } from "../toolkit.js";

/**
 * @typedef {("week"|"day"|"hour"|"minute"|"second"|"millisecond"|"microsecond"|"nanosecond")} DateUnit
 * 
 * @typedef DurationFormatUnit
 * @property {DateUnit} origin 原始数值对应的单位名称
 * @property {DateUnit} target 目标数值对应的单位名称
 * 
 * @typedef DurationFormatConvertMode
 * @property {("composite"|"separate")} convert 转换模式
 * @property {("carry"|"no-carry")} carry 进位模式
 */

const rate = {
    "week": 7 * 24 * 60 * 60 * 1000,
    "day": 24 * 60 * 60 * 1000,
    "hour": 60 * 60 * 1000,
    "minute": 60 * 1000,
    "second": 1 * 1000,
    "millisecond": 1,
    "microsecond": 1 / 1000,
    "nanosecond": 1 / 1000 / 1000
};

const nickname = {
    "week": "w",
    "day": "d",
    "hour": "h",
    "minute": [ "m", "min" ],
    "second": [ "s", "sec" ],
    "millisecond": "ms",
    "microsecond": "us",
    "nanosecond": "ns",
};

const rate_entries = Object.entries(rate), nickname_mapping = {};

Object.entries(nickname).map((item) => ([
    item[1], item[0], item[0] + "s"
]).flat().map((key) => {
    nickname_mapping[key] = item[0];
}));

const default_mode_config = {
    "convert": "separate"
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
 * 
 * @returns {string} 替换值
 */
function replacer(table, match) {
    let value = table._invalid ?? "N/A",
        parameter = match[1].split(/\s*,\s*/);

    let field = nickname_mapping[parameter[0]] ?? parameter[0];

    if (table[field] !== undefined) {
        let length = parseInt(parameter[1]) || 1;

        value = repair(
            table[field].toString(),
            Math.abs(length) || {
                "year": 4,
                "timestamp": 3
            }[field] || 2,
            parameter[2] ?? "0",
            length >= 0 ? "start" : "end"
        );
    };

    return value;
}

/**
 * 将原始的时间信息元组根据给定的目标单位名称完成单位换算
 * 
 * @param {number} number 换算基准数字
 * @param {object} date_info 需要进行转换的时间信息元组
 * @param {string} target_unit 主要分离到的目标的单位名称
 * 
 * @returns {object} 转换完成的时间信息元组
 */
function separate(number, date_info, target_unit) {
    let is_find = false, result = deep_clone(date_info);
    let list = rate_entries.sort((a, b) => {
        return b[1] - a[1];
    });

    for (let index = 0; index < list.length; index++) {
        let current = list[index], unit = current[0];

        if (unit === target_unit) {
            is_find = true;
        };

        if (is_find) {
            result[unit] = Math.floor(number / rate[unit]);

            number -= result[unit] * current[1];
        }
    }

    return result;
}

/**
 * 将原始的时间信息元组根据给定的目标单位名称完成进位
 * 
 * @param {object} date_info 需要进行转换的时间信息元组
 * 
 * @returns {object} 转换完成的时间信息元组
 */
function carry(date_info) {
    let result = deep_clone(date_info);
    let list = rate_entries.sort((a, b) => {
        return a[1] - b[1]
    });

    for (let index = 0; index < list.length; index++) {
        let current = list[index];

        if (current[1] < 1) {
            result[list[index + 1][0]] += result[current[0]] / 1000;

            result[current[0]] = 0;
        }
    }

    return result;
}

/**
 * 将时长格式化为字符串（依据目标单位进行转换）
 * 
 * #### 对于转换模式的解释
 * - 分离：103sec -> 1min + 43sec + 0ms + 0us + 0ns
 * - 复合：103sec -> 1.7166666666666666min
 * 
 * #### 对于进位模式的解释
 * - 进位：104.566sec -> 1min + 44.566sec
 * - 不进位：104.566sec -> 1min + 44sec + 566ms
 * 
 * @param {number} value 原始数值
 * @param {DurationFormatUnit} unit 单位信息
 * @param {string} expression 格式表达式
 * @param {DurationFormatConvertMode} mode 模式信息
 * 
 * @returns {string} 格式化之后的字符串
 */
export function format(value, unit, expression, mode = default_mode_config) {
    if (value < 0) return "-" + format(
        -value, unit, expression, mode
    );

    let {
        "convert": convert_mode, "carry": carry_mode
    } = mode, date_info = {};

    let origin_unit = nickname_mapping[unit.origin || unit[0]],
        target_unit = nickname_mapping[unit.target || unit[1]];

    let number = value * rate[origin_unit];

    Object.keys(rate).map((key) => {
        date_info[key] = 0;
    });

    if (convert_mode === "composite") {
        date_info = {
            "value": number / rate[target_unit]
        };
    }

    if (convert_mode === "separate") {
        date_info = separate(
            number, date_info, target_unit
        );
    }

    if (carry_mode === "no-carry") {
        date_info[target_unit] = number / rate[target_unit];
    }

    if (carry_mode === "carry") {
        date_info = carry(
            date_info
        );
    }

    return interpolator(
        expression, {
            ...date_info,
            "raw": value
        }, replacer
    );
}