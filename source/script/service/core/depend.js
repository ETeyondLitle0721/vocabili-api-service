import fs from "fs";
import path from "path";
import { quote_string, unique_array } from "../../../depend/core.js";

const root = path.resolve(".");

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    )
};

/**
 * 切割目标参数和并表达式为数组
 * 
 * @param {(string|string[])} value 需要解析的参数合并表达式
 * @returns {string[]} 解析出来的参数数组
 */
function split_value(value) {
    if (!Array.isArray(value)) {
        value = [ value ];
    }

    const list = unique_array(value.map(
        item => item.split(",").map(
            item => item.trim()
        )
    ).flat());

    return list.filter(
        item => item !== ""
    );
}


/**
 * 解析请求体中的参数
 * 
 * @param {Request} request 需要解析的请求体
 * @returns {GeneralObject} 解析到的参数
 */
export function parse_parameter(request) {
    const parameter = Object.assign(
        request.query, request.params
    );

    for (const [ key, value ] of Object.entries(parameter)) {
        if (!value) {
            parameter[key] = [];

            continue;
        }

        parameter[key] = split_value(value);
    }

    return parameter;
}

/**
 * 检查参数合法性
 * 
 * @param {{ "request": Express.Request, "response": Express.Response }} instance 请求、响应的实例化对象
 * @param {string} name 参数的名称
 * @param {number} receive 接受请求时间刻度
 * @param {(any[]|string|number)} target 需要检查的参数
 * @param {("number"|"count""list")} mode 参数检查的模式
 * @param {{ "type": ("integer"), "range": { "minimum": number, "maximum": number } }} options 检查器配置
 * @returns 检查结果
 */
export function check_parameter(instance, name, receive, target, mode, options) {
    const res = instance.response;

    const param = {}, result = {
        "invalid": true
    };

    const prefix = res.get_local_text(
        "CHECK_PARAMETER_PREFIX", {
            "TARGET_PARAMETER": res.get_local_text(
                "TARGET_PARAMETER", {
                    "name": name.toUpperCase(),
                }
            )
        }
    );

    if (mode === "number") {
        if (target === undefined) {
            result.code = "TARGET_NOT_EXISTS";
        } else if (!isFinite(target)) {
            result.code = "TARGET_NOT_NUMBER";
        } else {
            target = Number(target);

            if (options.type === "integer" && target % 1 !== 0) {
                result.code = "NUMBER_NOT_INTEGER";
            }

            if (options.range) {
                const { minimum, maximum } = options.range;

                if (minimum > target || maximum < target) {
                    result.code = "NUMBER_OUT_OF_RANGE";

                    param.minimum = minimum;
                    param.maximum = maximum;
                }
            }

            param.target = quote_string(target);
        }
    }
                    
    if (mode === "count") {
        const length = target ? target.length : 0;

        if (length === 0) {
            result.code = "TARGET_NOT_EXISTS";
        }

        if (options.range) {
            const { maximum } = options.range;

            if (maximum < length) {
                if (maximum === 1) {
                    result.code = "DISALLOW_MULTIPLE_TARGET";
                } else {
                    result.code = "COUNT_OUT_OF_RANGE";

                    param.length = length;
                    param.maximum = maximum;
                }
            }
        }
    }

    if (mode === "list") {
        if (Array.isArray(target)) target = target[0];
        
        if (!options.list.includes(target)) {
            result.code = "PARAMETER_VALUE_ILLEGAL";

            param.enum = options.list.map(item => {
                return quote_string(item, "double");
            }).join(", ");
            param.target = quote_string(target, "double");
        }
    }

    result.message = prefix + res.get_local_text(
        result.code, param
    );

    if (result.code) res.send(build_response(
        instance, { receive },
        result.code, result.message
    ));

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
export function build_response(instance, data = {}, code = "OK", message) {
    const { request } = instance, result = {
        "code": code, "time": new Date(), "data": data.data,
        "status": code === "OK" ? "success" : "failed",
        "message": typeof message === "string" ?
            message : instance.response.get_local_text(code, message)
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
                        consume * 1000 < 1 ? parseInt(consume * 1000000) + "us" :
                        parseInt(consume * 1000000) / 1000 + "ms"
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