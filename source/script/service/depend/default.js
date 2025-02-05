import fs from "fs";
import path from "path";
import { quote_string } from "../../../depend/core.js";

const root = path.resolve(".");

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    )
};

/**
 * 解析请求体中的参数
 * 
 * @param {Request} request 需要解析的请求体
 * @returns {GeneralObject} 解析到的参数
 */
export function parse_parameter(request) {
    /**
     * 切割目标参数和并表达式为数组
     * 
     * @param {string} value 需要解析的参数合并表达式
     * @returns {string[]} 解析出来的参数数组
     */
    function split_value(value) {
        const result = Array.from(new Set([value].flat().map((item) => {
            return item.split(",").map((item) => {
                return item.trim()
            });
        }).flat())).filter((item) => {
            return item !== "";
        });

        if (result.length === 1) {
            if (isFinite(result[0])) return Number(result[0]);
        }

        return result;
    }

    const parameter = Object.assign(
        request.query, request.params
    );

    return Object.fromEntries(
        Object.entries(parameter).map(entry => {
            return [
                entry[0], entry[1] ? split_value(
                    entry[1]
                ) : []
            ];
        })
    );
}

/**
 * 检查参数合法性
 * 
 * @param {{ "request": Express.Request, "response": Express.Response }} instance 请求、响应的实例化对象
 * @param {string} name 参数的名称
 * @param {number} receive 接受请求时间刻度
 * @param {(any[]|string|number)} target 需要检查的参数
 * @param {("number"|"count")} mode 参数检查的模式
 * @param {{ "type": ("integer"), "range": { "minimum": number, "maximum": number } }} options 检查器配置
 * @returns 检查结果
 */
export function check_parameter(instance, name, receive, target, mode, options) {
    let result = { "invalid": true };

    const prefix = `目标参数(Name=${name.toUpperCase()})所传递的参数`;

    if (mode === "number") {
        if (!target) {
            result.code = "TARGET_NOT_EXISTS";
            result.message = prefix + `被要求必须指定，但是实际上没有传递参数。`;
        } else if (!isFinite(target)) {
            result.code = "TARGET_NOT_NUMBER";
            result.message = prefix + "不是一个合法的数字（允许二、八、十、十六进制数值）。";
        } else {
            target = Number(target);

            if (options.type === "integer" && target % 1 !== 0) {
                result.code = "NUMBER_NOT_INTEGER";
                result.message = prefix + `被要求为是一个整数，但是 ${quote_string(target)} 实际并非一个整数。`;
            }

            if (options.range) {
                const { minimum, maximum } = options.range;

                if (minimum > target || maximum < target) {
                    result.code = "NUMBER_OUT_OF_RANGE";
                    result.message = prefix + `被要求符合大于 ${minimum} 并且同时小于 ${maximum}，但是 ${target} 并不满足条件。`;
                }
            }
        }
    }
                    
    if (mode === "count") {
        const length = target ? target.length : 0;

        if (length === 0) {
            result.code = "TARGET_NOT_EXISTS";
            result.message = prefix + `被要求必须指定，但是实际上没有传递参数。`;
        }

        if (options.range) {
            const { maximum } = options.range;

            if (maximum < length) {
                if (maximum === 1) {
                    result.code = "DISALLOW_MULTIPLE_TARGET";
                    result.message = prefix + `不允许多目标表达式。`;
                } else {
                    result.code = mode.toUpperCase() + "_OUT_OF_RANGE";
                    result.message = prefix + `传递的参数数量太多了，最多只能为 ${maximum} 个，但是目前有 ${length} 个参数被传递。`;
                }
            }
        }
    }

    if (result.code) {
        instance.response.send(build_response(
            instance, { receive }, result.code, result.message
        ));
    }

    return !result.code;
}

/**
 * 构建响应体
 * 
 * @param {{ "request": Express.Request, "response": Express.Response }} instance 请求、响应的实例化对象
 * @param { { "receive": number, "extra": object, "param": Object<string, string[]> } } data 传递的数据
 * @param {("OK")} code 传递的状态码
 * @param {string} message 传递的消息
 * @returns 构建出来的响应体
 */
export function build_response(instance, data = {}, code = "OK", message = "一切正常") {
    const { request } = instance, result = {
        "code": code, "time": new Date(), "data": data.data,
        "status": code === "OK" ? "success" : "failed", "message": message
    };

    if (data.extra) result.extra = data.extra;
    if (data.param) result.param = data.param;

    if (!config.global.debug) return result;

    const consume = process.uptime() - data.receive;

    result.extra = Object.assign(
        result.extra || {}, {
            "debug": {
                "timing": {
                    "receive": new Date(performance.timeOrigin + data.receive * 1000),
                    "current": new Date(), "consume": 
                        consume * 1000 < 1 ? parseInt(consume * 1000000) + "us" : parseInt(consume * 1000000) / 1000 + "ms"
                },
                "request": {
                    "parmas": parse_parameter(request),
                    "headers": request.headers,
                    "address": request.ip,
                    "resource": request.path
                }
            }
        }
    );

    return result;
}