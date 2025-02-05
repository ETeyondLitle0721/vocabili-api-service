import { split_group } from "../../core.js";

/**
 * 将一个数字格式化成字符串
 * 
 * @param {number} num 需要格式化的数字
 * @param {number} length 分组的长度
 * @param {("auto"|number)} precision 期望的小数部分的位数
 * @param {object} joiner 每个数字单元之间的连接字符
 * @param {string} joiner.integer 整数部分使用的连接字符
 * @param {string} joiner.decimal 小数部分使用的连接字符
 * @param {string} joiner.spliter 整数部分和小数部分使用的连接字符
 * 
 * @returns {string} 格式化之后的字符串
 */
export function format_number(num, length = 3, precision = "auto", joiner = {
    "integer": ",", "decimal": " ", "spliter": "."
}) {
    let sign = num > 0 ? "" : "-", string = "";

    if (typeof num === "bigint") {
        string = num.toString();
    } else {
        string = Math.abs(num).toPrecision(100);
    }

    let number_length = string.length;
    let integer = string.slice(0, string.indexOf(".") || number_length);
    let decimal = string.slice(string.indexOf(".") + 1 || number_length, number_length);

    if (integer.indexOf("e")) {
        integer = num.toLocaleString("zh-Hant-TW").split(".")[0].split(",").join("");
    }

    if (precision !== "auto") {
        decimal = decimal.slice(0, precision);
    } else if (decimal.match(/[0]{1,}$/)) {
        decimal = decimal.replace(/[0]{1,}$/, "");
    }

    integer = split_group(integer, length, "end").reverse().join(joiner.integer);
    decimal = split_group(decimal, length, "start").join(joiner.decimal);

    let result = sign + integer;

    if (decimal) {
        result += joiner.spliter + decimal;
    }
    
    return result;
}

export default format_number;