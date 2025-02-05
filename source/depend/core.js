import fs from "node:fs";
import net from "node:net";
import crypto from "node:crypto";

/**
 * 将传入的文本的部分进行处理
 * 
 * @param {string} text 要处理的原始文本
 * @param {number} length 要大写的长度（正整数从前到后，负整数从后到前）
 * @param {((text: string) => string)} transformer 文本变换器
 * @returns {string} 经过处理的原始文本
 */
export function text_transformer(text, length = 1, transformer = (text) => text.toUpperCase()) {
    if (length < 0) {
        const start = text.length + length;
        
        return text.slice(0, start) + transformer(text.slice(start));
    }

    return transformer(text.slice(0, length)) + text.slice(length);
}

/**
 * 使用 Crypto 通过一段文本计算出其摘要值
 * 
 * @param {string} text 一段文本
 * @param {("UTF-8"|"Base64"|"ASCII"|"HEX")} charset 计算的时候使用的文本编码
 * @param {("MD5"|"SHA-1"|"SHA-3"|"SHA-256"|"SHA-512")} algorithm 计算的时候使用的摘要算法
 * @returns {string} 这段文本对应的SHA256摘要值
 */
export function compute_hash(text, charset = "UTF-8", algorithm = "SHA-256") {
    let hash = crypto.createHash(algorithm);
    
    hash.update(text, charset);
    
    return hash.digest("hex");
}

/**
 * 使用 Crypto 的 HAMC 计算一段文本的哈希值
 * 
 * @param {string} text 需要计算哈希值的文本
 * @param {("MD5"|"SHA-1"|"SHA-3"|"SHA-256"|"SHA-512")} algorithm 计算哈希值时的使用的算法
 * @param {"default-secret"} secret 计算哈希值时的密钥
 * @returns {string} 文本的哈希值
 */
export function compute_hamc(text, algorithm = "SHA-256", secret = "default-secret") {
    let hamc = crypto.createHmac(
        algorithm.replace("-", ""), secret
    );

    return hamc.update(text).digest("hex");
}

/**
 * 对字符串并进行补全操作
 * 
 * @param {string} string 需要进行处理的字符串
 * @param {number} length 期望转换成的字符串的长度
 * @param {string} character 补全字符串时使用的字符
 * @param {("start"|"end")} direction 追加字符的时候追加的方向
 * @returns {string} 处理好的字符串
 */
export function repair_character(string, length, character = " ", direction = "start") {
    let temp = to_string(string);

    if ([ "start", "end" ].includes(direction)) {
        let scheme = {
            "start": "padStart",
            "end": "padEnd"
        } [direction];

        return temp[scheme](
            length, character
        );
    }

    return temp;
}

/**
 * 随机生成字符串
 * 
 * @param {string} template 生成随机的格式
 * @param {string} character 用到的随机字符
 * @param {string} placeholder 表达随机的字符
 * @returns {string} 生成的随机字符串
 */
export function generate_random_string(template = "?".repeat(16), character = "0123456789ABCDEF", placeholder = "?") {
    while (template.indexOf(placeholder) != -1) {
        template = template.replace(
            placeholder, character[parseInt(
                Math.random() * character.length
            )]
        );
    }

    return template;
}

/** 
 * 将任意一个数据转换成字符串
 * 
 * @param {any} value 需要进行转换的数据
 * @returns {string} 转换出来的字符串
 */
export function to_string(value) {
    if ([
        "function", "string", "number", "boolean", "bigint"
    ].includes(typeof value)) {
        return value.toString();
    } else {
        return JSON.stringify(value);
    }
}

/**
 * 检查指定的 host 下的指定的端口是否可以创建一个服务
 * 
 * @param {string} host 需要检查的host
 * @param {number} port 需要检查的端口
 * @returns {Promise<boolean>} 是否可用
 */
export async function check_service_accessible(host, port) {
    return new Promise((resolve) => {
        let server = net.createServer();
        
        server.once("error", () => {
            resolve(true);
        });

        server.once("listening", () => {
            resolve(false);

            server.close();
        });

        server.listen(port, host);
    });
}

/**
 * 检查一个目录或者文件是否可以被访问
 * 
 * @param {string} path 需要检查是的目标路径
 * @returns {Promise<boolean>} 是否可以被访问
 */
export async function check_path_accessible(path) {
    return new Promise((resolve, _reject) => {
        fs.promises.access(path).then(() => {
            resolve(true);
        }).catch(() => {
            resolve(false);
        });
    });
}

/**
 * 将一个数字转换成字符串
 * 
 * @param {number} number 需要转换的目标数字（零或者正数）
 * @param {number} length 转换成的字符串的目标长度
 * @param {number} precision 字符串表达数字的期望精度
 * @returns {string} 转换出来的字符串
 */
export function number_to_string(number, length = 8) {
    let result = "";

    if (!isFinite(number)) {
        return "N/A";
    }

    let exp = Math.log10(number);

    if (exp > length) {
        let target = length - 4 - Math.log10(exp);

        if (target < 0) {
            return "N/A";
        }

        result = number.toExponential(target);
    } else {
        // let string = number.toString();
        let string = number.toPrecision(100);

        // result = number.toFixed(length - number_length);
        result = Number(string.slice(0, length)).toFixed(length - exp);
    }

    return result.slice(0, length);
}

/**
 * 对字符串或者数组分组
 * 
 * @param {(string|object[])} value 需要分组的目标
 * @param {(((index: number, list: string[][]) => number)|string|number[])} judger 取得分组规模的回调方法
 * @param {("start"|"end")} direction 分组的方向
 * @param {("lost-remain"|"reserve-remain")} remain 对于剩余不足矣分成一组的部分的处理方法
 * @returns {(string|object)[][]} 分组的结果
 */
export function split_group(value, judger, direction = "start", remain = "reserve-remain") {
    let result = [], offset = 0;

    if (!Array.isArray(value) && value[Symbol.iterator] !== undefined) {
        result = Array.from(result);
    }

    const get_offset = (getter, ...arg) => {
        if (typeof getter === "number") return getter;

        if (Array.isArray(getter)) return get_offset(
            getter[Symbol.iterator](), ...arg
        );

        if (getter[Symbol.iterator] !== undefined) {
            return getter.next(...arg).value;
        }

        return getter(...arg);
    }

    if (direction === "start") {
        for (let index = 0; index < value.length; index += offset) {
            offset = get_offset(judger, result.length, result);

            result.push(
                value.slice(
                    index, index + offset
                )
            );
        }
    } else {
        for (let index = value.length; index >= 0; index -= offset) {
            offset = get_offset(judger, result.length, result);

            result.push(
                value.slice(
                    Math.max(
                        index - offset, 0
                    ), index
                )
            );
        }
    }

    if (remain === "lost-remain" && result.at(-1).length < offset) {
        result.pop();
    }

    return result.filter((item) => {
        return item.length !== 0;
    });
}

/**
 * 将一个对象深度冻结
 * 
 * @template T
 * @param {T} target 需要深度冻结的目标对象
 * @returns {Readonly<T>} 被深度冻结了的对象
 */
export function deep_freeze(target) {
    let key_list = Object.keys(target);

    for (let index = 0; index < key_list.length; index++) {
        let value = target[key_list[index]];

        if (typeof value === "object") {
            deep_freeze(value);
        }
    }

    return Object.freeze(target);
}

/**
 * 将一个对象深度克隆
 * 
 * @template T
 * @param {T} target 需要深度克隆的对象
 * @returns {T} 深度克隆的结果
 */
export function deep_clone(target) {
    let result = Array.isArray(target) ? [] : {};
    
    if (target === null || typeof target !== "object") {
        return target;
    }

    let key_list = Object.keys(target);

    for (let index = 0; index < key_list.length; index++) {
        let key = key_list[index];
        
        result[key] = deep_clone(
            target[key]
        );
    }

    return result;
}

/**
 * 反转对象的键值何键名（键值和键名对调，出现重复的保留最后一个）
 * 
 * @param {Record<string, (string|number|boolean)>} target 需要反转的对象
 * @returns {Record<(string|number|boolean), string>} 反转后的对象
 */
export function invert_object(target) {
    let result = {}, entries = Object.entries(target);

    for (let index = 0; index < entries.length; index++) {
        let entry = entries[index];

        result[entry[1]] = entry[0];
    }

    return result;
}

/**
 * 返回一个被引用了的传入字符串
 * 
 * @param {string} target 需要引用的原始字符串
 * @param {("single"|"double")} type 引用字符串使用的引号类型
 * @returns {string} 被引用的字符串
 */
export function quote_string(target, type = "double") {
    let quote = {
        "single": "'", "double": '"'
    } [type], result = "";

    target = to_string(target);

    for (let index = 0; index < target.length; index++) {
        let current = target[index];
        
        if (current[index - 1] !== "\\" && current === quote) {
            result += "\\" + quote;
        } else {
            result += current;
        }
    }

    return `${quote}${result}${quote}`;
}

/**
 * 比较两个对象（对象、数组、数字、字符串）是否相等（引用、键值对）
 * 
 * @param {Object} obj1 第一个对象
 * @param {Object} obj2 第二个对象
 * @returns {boolean} 是否相等
 */
export function compare_object(obj1, obj2) {
    if (obj1 === obj2) return true;

    if (Object.prototype.toString.call(obj1) !== Object.prototype.toString.call(obj2)) return false;
    
    if (obj1 == null || obj2 == null || typeof obj1 !== "object" || typeof obj2 !== "object") return false;

    if (Number.isNaN(obj1) && Number.isNaN(obj2)) return true;

    let key_list = [
        Object.keys(obj1).sort(), Object.keys(obj2).sort()
    ];

    if (key_list[0].length !== key_list[1].length) return false;

    for (let index = 0; index < key_list[0].length; index++) {
        let current = [
            key_list[0][index], key_list[1][index]
        ];

        if (current[0] !== current[1]) return false;

        if (!compare_object(
            obj1[current[0]], obj2[current[1]]
        )) return false;
    }

    return true;
}

/**
 * 获取目标的数据类型
 * 
 * @typedef {("abnormal"|"object"|"number"|"string"|"symbol"|"boolean"|"function")} FirstType
 * @typedef {("nan"|"undefined"|"null"|"object"|"true"|"false"|"string"|"integer"|"decimal"|"class"|"normal"|"arrow"|"array")} SecondType
 * @typedef {("bigint"|"empty"|"circular")} ThirdType
 * 
 * @typedef GenTypeReturn
 * @property {FirstType} first 第一类型
 * @property {SecondType} second 第二类型
 * @property {ThirdType} third 第三类型
 * 
 * @param {any} value 需要获取数据类型的目标
 * @returns {GenTypeReturn} 目标的数据类型的
 */
export function get_type(value) {
    let result = [], type = typeof value;

    if ((Number.isNaN(value) || !value) && value !== 0 && value !== false) {
        result[0] = "abnormal";

        if (Number.isNaN(value)) {
            result[1] = "nan";
        } else {
            result[1] = to_string(type);
        };
    } else if (type === "object") {
        result[0] = "object";

        if (Array.isArray(value)) {
            result[1] = "array";

            if (value.length === 0) {
                result[2] = "empty";
            }
        } else {
            result[1] = "object";

            if (Object.keys(value).length == 0) {
                result[2] = "empty";
            }
        }

        try {
            JSON.stringify(value);
        } catch (error) {
            result[2] = "circular";
        }
    } else if (type === "function") {
        result[0] = "function";

        if (value.constructor.name === "AsyncFunction") {
            result[1] = "async";
        } else if (Function.prototype.toString.call(value).indexOf("class") === 0) {
            result[1] = "class";
        } else if (!value.prototype) {
            result[1] = "arrow";
        } else {
            result[1] = "normal";
        }
    } else if (type === "number" || type === "bigint") {
        result[0] = "number";

        if (type === "bigint") {
            result[1] = "integer";
            result[2] = "bigint";
        } else {
            if (value % 1 === 0) {
                result[1] = "integer";
            } else {
                result[1] = "decimal";
            }
        }
    } else if (type === "boolean") {
        result[0] = "boolean";

        result[1] = to_string(value);
    } else {
        result = [
            type, type
        ];

        if (type === "string" && value.length === 0) {
            result[2] = "empty";
        }
    }

    if (result[2]) {
        return {
            "first": result[0],
            "second": result[1],
            "third": result[2]
        };
    } else {
        return {
            "first": result[0],
            "second": result[1]
        };
    };
}

/**
 * 去重数组中的重复元素
 * 
 * @template T
 * @param {T} arr 输入的数组
 * @returns {T} 去重后的数组
 */
export function unique_array(arr = []) {
    const result = [];

    arr.map(item => {
        if (!result.some(existingItem => compare_object(existingItem, item))) {
            result.push(item);
        }
    });

    return result;
}

/**
 * 打乱数组中的元素顺序
 * 
 * @template T
 * @param {T} arr 输入的数组
 * @returns {T} 打乱顺序后的数组
 */
export function upset_array(arr = []) {
    return arr.sort(() => Math.random() - 0.5);
}

/**
 * 从数组中随机选择指定数量的元素
 * 
 * @template T
 * @param {T} arr 输入的数组
 * @param {number} amount 需要选取的元素数量
 * @returns {T} 随机选择后的数组
 */
export function pick_array(arr = [], amount = 1) {
    let result = [];

    for (let i = 0; i < amount; i++) {
        result.push(arr[Math.floor(Math.random() * arr.length)]);
    }

    return result;
}

/**
 * 等待一段时间返回一个数据
 * 
 * @template T
 * @param {number} count 需要等待的毫秒数
 * @param {T} result 等待之后返回的数据
 * @returns {Promise<T>} 等待一段时间后会返回响应数据的 Promise 实例
 */
export async function waiting(count, result = null) {
    return new Promise((resolve, _reject) => {
        setTimeout(() => {
            resolve(result);
        }, count);
    })
}

/**
 * 将字符串中的正则表达式敏字符转义
 * 
 * @param {string} regexp_string 需要转义的原始字符串
 * 
 * @returns {string} 将 RegExp 中的敏感部分转义后的字符串
 */
export function escape_regexp_string(regexp_string) {
    return regexp_string.replaceAll(
        /[.*+?^${}()|[\]\\]/g, "\\$&"
    );
}

/**
 * 对一个数组中的元素进行分类
 * 
 * @callback ClassificationNamer
 * @param {any} value 需要进行命名的目标
 * @param {number} index 目标在列表中的索引
 * @param {any[]} list 目标所处的数组
 * @returns {string} 给目标的名字
 * 
 * @param {any[]} list 需要进行分类的数组
 * @param {ClassificationNamer} namer 为每个子元素命名的回调方法
 * @returns {Object<string, any[]>} 分类的结果
 */
export function classification(list, namer) {
    const result = {};

    for (let index = 0; index < list.length; index++) {
        const current = list[index], name = namer(
            current, index, list
        );

        if (result[name]) {
            result[name].push(current);
        } else {
            result[name] = [ current ];
        }
    }

    return result;
}

/**
 * 为数组中的对象添加基于指定字段排序后的排名（rank）字段。
 * 
 * 该方法通过给定字段进行排序，为每个对象添加一个 `_rank` 属性，表示其在排序后的位置。
 * 排序是根据多个字段按顺序进行的，排名会根据字段值的比较结果逐步确定。
 * 
 * @param {object[]} array 需要添加排名字段的对象数组。
 * @param {string[]} fields 用于排序的字段数组。会按字段顺序逐一进行排序。
 * @param {(a: any, b: any) => number} judger 排序比较函数。默认使用降序数字比较。
 * @param {(field: string, object: object) => any} getter 获取字段值的函数。默认通过对象的字段直接获取值。
 * @param {(rank: number, object: object) => object} setter 设置排名的函数。默认将排名 `rank` 添加到对象中。
 * @returns {object[]} 返回添加了排名字段（rank）的对象数组。
 */
export function append_rank_field(
    array, fields, judger = (a, b) => b - a,
    getter = (field, object) => object[field],
    setter = (rank, object) => Object.assign(object, { "_rank": rank })
) {
    const uuid_list = array.map(_ => crypto.randomUUID()), rank = Object.fromEntries(
        uuid_list.map(uuid => ([
            uuid, {}
        ]))
    );

    for (let index = 0; index < fields.length; index++) {
        const field = fields[index], tuples = array.map((item, index) => ({
            "uuid": uuid_list[index], "value": getter(field, item)
        })).sort((a, b) => judger(a.value, b.value));

        tuples.forEach((item, index) => rank[item.uuid][field] = index);
    }

    return uuid_list.map((uuid, index) => setter(
        rank[uuid], array[index]
    ));
}