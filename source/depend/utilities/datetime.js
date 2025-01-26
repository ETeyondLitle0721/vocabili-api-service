import duration from "../toolkit/formatter/duration.js";

const rate = {
    "day": 24 * 60 * 60 * 1000,
    "week": 7 * 24 * 60 * 60 * 1000
};

/**
 * 通过给定的时间对象获取时间信息
 * 
 * @param {Date} date 需要获取信息的 Date 实例化对象
 * @param {("UTC"|"SYS")} version 时间版本
 * @returns 通过 Date 实例化对象获取的时间信息
 */
export function get_date_info(date = new Date(), version = "SYS") {
    if (version === "SYS") {
        return {
            "day": date.getDate(),
            "year": date.getFullYear(),
            "hour": date.getHours(),
            "millisecond": date.getMilliseconds(),
            "minute": date.getMinutes(),
            /** @description 取值为 1-12 */
            "month": date.getMonth() + 1,
            "second": date.getSeconds(),
            "timezone": get_timezone(),
            "timestamp": date.getTime(),
            /** @description 取值为 1-7 */
            "week": (date.getDay() + 6) % 7 + 1,
            "week_number": get_week_number(date)
        }
    }
    
    return {
        "day": date.getUTCDate(),
        "year": date.getUTCFullYear(),
        "hour": date.getUTCHours(),
        "millisecond": date.getUTCMilliseconds(),
        "minute": date.getUTCMinutes(),
        /** @description 取值为 1-12 */
        "month": date.getUTCMonth() + 1,
        "second": date.getUTCSeconds(),
        "timezone": get_timezone(),
        "timestamp": date.getTime(),
        /** @description 取值为 1-7 */
        "week": (date.getUTCDay() + 6) % 7 + 1,
        "week_number": get_week_number(date)
    }
}

/**
 * 获取当前的操作系统中设定的时区信息
 * 
 * @returns {string} 时区信息
 */
export function get_timezone() {
    let timezone = new Date().getTimezoneOffset(), sign = timezone > 0 ? "-" : "+";

    return "UTC" + sign + duration(
        Math.abs(timezone), {
            "origin": "minute",
            "target": "hour"
        }, "{{hour, 2}}:{{minute, 2}}"
    );
} 1

/**
 * 通过 Date 实例化对象获取当前天所处的周是当前年中的第几周
 * 
 * @param {Date} date Date 实例化对象
 * @returns {number} 当前天所处的周在当前年中的周数
 */
export function get_week_number(date = new Date()) {
    let instance = new Date(date.getTime());

    instance.setMonth(0, 1), instance.setHours(0, 0, 0, 0);

    let week = (instance.getDay() + 6) % 7 + 1,
        difference = date.getTime() - instance.getTime();

    return Math.ceil((difference + (week - 1) * rate.day) / rate.week);
}

export default {
    get_date_info, get_timezone, get_week_number
};