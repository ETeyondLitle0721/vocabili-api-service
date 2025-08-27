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
 * 返回一个被引用了的传入字符串
 * 
 * @param {string} target 需要引用的原始字符串
 * @param {("single"|"double")} type 引用字符串使用的引号类型
 * @returns {string} 被引用的字符串
 */
export function quote_string(target, type = "double") {
    let result = "";

    const quote = {
        "single": "'", "double": '"'
    }[type];

    target = to_string(target);

    for (let index = 0; index < target.length; index++) {
        const current = target[index];

        if (current[index - 1] !== "\\" && current === quote) {
            result += "\\" + quote;
        } else {
            result += current;
        }
    }

    return `${quote}${result}${quote}`;
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