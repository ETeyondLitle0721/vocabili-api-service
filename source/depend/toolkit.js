/**
 * 制作一个 TimeTick 对象
 * 
 * @typedef TimeTick
 * @property {Date} date 当前的 Date 实例化对象
 * @property {string} text 当前的 ISO 8601 高精度时间
 * 
 * @param {number} [precision=9] 精度
 * @returns {TimeTick} 制作好的对象
 */
export function timetick(precision = 9) {
    const _get = (precision) => {
        const uptime = process.uptime();
        const origin = performance.timeOrigin / 1000;

        const suffix = (
            (origin + uptime) % 1 * 1000
        ).toFixed(precision).padStart(
            precision + 4, "0"
        ).replace(".", "");

        return new Date().toISOString()
            .replace(/\d{3}Z/, suffix + "Z");
    };

    const timetext = _get(precision - 3);

    const datetime = new Date(timetext);

    return { text: timetext, date: datetime };
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
 * @template T
 * @param {T[]} list 需要进行分类的数组
 * @param {ClassificationNamer} namer 为每个子元素命名的回调方法
 * @returns {Object<string, T[]>} 分类的结果
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
 * 解析 Process.argv 里面的参数
 * 
 * @param {string[]} content 参数列表
 * @returns {Object<string, string>} 解析结果
 */
export function command_parser(content) {
    const result = {};

    for (let index = 0; index < content.length; index++) {
        const element = content[index];
        const part = element.split("=")
            .map(item => item.trim());
        
        if (part.length !== 2) continue;

        result[part[0]] = part[1];
    }

    return result;
}

/**
 * 对字符串或者数组分组
 * 
 * @typedef {(index: number, list: string[][]) => number} GroupJudger 
 * 
 * @param {(string|object[])} value 需要分组的目标
 * @param {(GroupJudger|string|number[])} judger 取得分组规模的回调方法
 * @param {("lost-remain"|"reserve-remain")} remain 对于剩余不足矣分成一组的部分的处理方法
 * @returns {(string|object)[][]} 分组的结果
 */
export function split_group(value, judger, remain = "reserve-remain") {
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

    for (let index = 0; index < value.length; index += offset) {
        offset = get_offset(judger, result.length, result);

        result.push(value.slice(index, index + offset));
    }

    if (remain === "lost-remain" && result.at(-1).length < offset) {
        result.pop();
    }

    return result.filter((item) => {
        return item.length !== 0;
    });
}

/**
 * 将一个对象深度克隆
 * 
 * @template T
 * @param {T} target 需要深度克隆的对象
 * @returns {T} 深度克隆的结果
 */
export function deep_clone(target) {
    const result = Array.isArray(target) ? [] : {};

    if (target === null || typeof target !== "object") {
        return target;
    }

    const key_list = Object.keys(target);

    for (let index = 0; index < key_list.length; index++) {
        const current_key = key_list[index];

        result[current_key] = deep_clone(
            target[current_key]
        );
    }

    return result;
}

/**
 * 反转对象的键值何键名（键值和键名对调，出现重复的保留最后一个）
 * 
 * @template {(string|number|symbol)} K 原始对象的键
 * @template {(string|number|symbol)} V 原始对象的值
 * 
 * @param {Record<K, V>} target 需要反转的对象
 * @returns {Record<V, K>} 反转后的对象
 */
export function invert_object(target) {
    const result = {}
    const entries = Object.entries(target);

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];

        result[entry[1]] = entry[0];
    }

    return result;
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
 * 对字符串并进行补全操作
 * 
 * @param {string} string 需要进行处理的字符串
 * @param {number} length 期望转换成的字符串的长度
 * @param {string} character 补全字符串时使用的字符
 * @param {("start"|"end")} direction 追加字符的时候追加的方向
 * @returns {string} 处理好的字符串
 */
export function repair_character(string, length, character = " ", direction = "start") {
    const temp = to_string(string);

    if (["start", "end"].includes(direction)) {
        const scheme = {
            "start": "padStart",
            "end": "padEnd"
        } [ direction ];

        return temp[scheme](
            length, character
        );
    }

    return temp;
}

/**
 * 对 BigInt 类型的数字进行除法操作
 * 
 * @param {bigint} a 除法运算中的除数
 * @param {bigint} b 除法运算中的被除数
 * @param {number} [precision=15] 期望精度
 * @returns {string} 除法运算结果
 */
export function bigint_divide(a, b, precision = 15) {
    const bscale = BigInt(precision);

    a *= 10n ** bscale;

    const result = (a / b).toString();

    const index = result.length - precision;

    if (index <= 0) {
        const zero = "0".repeat(-index);

        return "0." + zero + result;
    }

    const arr = result.split("");

    arr.splice(index, 0, ".");

    const text = arr.join("");

    if (text.endsWith(".")) {
        return text.slice(0, -1);
    }

    return text;
}