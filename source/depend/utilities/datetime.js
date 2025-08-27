import * as duration from "../toolkit/duration.js";

const rate = {
    "day": 24 * 60 * 60 * 1000,
    "week": 7 * 24 * 60 * 60 * 1000
};

/**
 * 通过给定的时间对象获取时间信息
 * 
 * @param {Date} instance 需要获取信息的 Date 实例化对象
 * @returns 通过 Date 实例化对象获取的时间信息
 */
export function get_date_info(instance = new Date()) {
    return {
        "day": instance.getDate(),
        "year": instance.getFullYear(),
        "hour": instance.getHours(),
        "millisecond": instance.getMilliseconds(),
        "minute": instance.getMinutes(),
        /** @description 取值为 1-12 */
        "month": instance.getMonth() + 1,
        "second": instance.getSeconds(),
        "timezone": get_timezone(),
        "timestamp": instance.getTime(),
        /** @description 取值为 1-7 */
        "week": (instance.getDay() + 6) % 7 + 1,
        "week_number": get_week_number(instance)
    }
}

/**
 * 获取当前的操作系统中设定的时区信息
 * 
 * @returns {string} 时区信息
 */
export function get_timezone() {
    const timezone = new Date().getTimezoneOffset(),
        sign = timezone > 0 ? "-" : "+";

    const format = duration.format;

    return "UTC" + sign + format(
        Math.abs(timezone), {
            "origin": "minute",
            "target": "hour"
        }, "{{hour, 2}}:{{minute, 2}}"
    );
}

/**
 * 通过 Date 实例化对象获取当前天所处的周是当前年中的第几周
 * 
 * @param {Date} date Date 实例化对象
 * @returns {number} 当前天所处的周在当前年中的周数
 */
export function get_week_number(date = new Date()) {
    const instance = new Date(date.getTime());

    instance.setMonth(0, 1), instance.setHours(0, 0, 0, 0);

    const week = (instance.getDay() + 6) % 7 + 1,
        difference = date.getTime() - instance.getTime();

    return Math.ceil((difference + (week - 1) * rate.day) / rate.week);
}