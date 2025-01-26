import { deep_clone, invert_object, to_string } from "../../core.js";

/**
 * @typedef {("bold"|"dim"|"italic"|"underline"|"blink"|"inverse"|"hidden"|"strikethrough")} ANSIMark
 * @typedef {("black"|"red"|"green"|"yellow"|"blue"|"magenta"|"cyan"|"white"|"gray"|"black-bright"|"red-bright"|"green-bright"|"yellow-bright"|"blue-bright"|"magenta-bright"|"cyan-bright"|"white-bright")} ANSIColor
 * @typedef {("orange"|"pink"|"purple"|"brown"|"teal"|"lime"|"indigo"|"violet"|"gold"|"beige"|"ivory"|"lavender"|"coral"|"turquoise"|"charcoal"|"aqua"|"chartreuse"|"periwinkle"|"salmon"|"khaki"|"plum"|"crimson"|"seashell"|"mint"|"peach"|"cherry"|"rose"|"skyblue"|"orchid"|"azure"|"zircon")} ExtraColor
 * 
 * @typedef ANSISequenceTextUnit
 * @property {string} text 需要添加样式的文本
 * @property {object} color 颜色信息
 * @property {(ANSIColor|ExtraColor)} color.background 背景色（支持以 rgb(rrr, ggg, bbb) 的形式表达）
 * @property {(ANSIColor|ExtraColor)} color.foreground 前景色（支持以 rgb(rrr, ggg, bbb) 的形式表达）
 * @property {(ANSIMark[]|ANSIMark)} mark 叠加的标记信息
 */

/**
 * 映射颜色名称到 ANSI 转义码
 */
const ansi_color = {
    "black": 30, "red": 31, "green": 32, "yellow": 33, "blue": 34, "magenta": 35,
    "cyan": 36, "white": 37, "gray": 90, "black-bright": 90, "red-bright": 91,
    "green-bright": 92, "yellow-bright": 93, "blue-bright": 94, "magenta-bright": 95,
    "cyan-bright": 96, "white-bright": 97
};

/**
 * 额外扩展颜色
 */
const extra_color = {
    "orange": "rgb(255, 165, 0)", "pink": "rgb(255, 192, 203)",
    "purple": "rgb(128, 0, 128)", "brown": "rgb(165, 42, 42)",
    "teal": "rgb(0, 128, 128)", "lime": "rgb(0, 255, 0)",
    "indigo": "rgb(75, 0, 130)", "violet": "rgb(238, 130, 238)",
    "gold": "rgb(255, 215, 0)", "beige": "rgb(245, 245, 220)",
    "ivory": "rgb(255, 255, 240)", "lavender": "rgb(230, 230, 250)",
    "coral": "rgb(255, 127, 80)", "turquoise": "rgb(64, 224, 208)",
    "charcoal": "rgb(54, 69, 79)", "aqua": "rgb(0, 255, 255)",
    "chartreuse": "rgb(127, 255, 0)", "periwinkle": "rgb(204, 204, 255)",
    "salmon": "rgb(250, 128, 114)", "khaki": "rgb(240, 230, 140)",
    "plum": "rgb(221, 160, 221)", "crimson": "rgb(220, 20, 60)",
    "seashell": "rgb(255, 245, 238)", "mint": "rgb(189, 252, 201)",
    "peach": "rgb(255, 218, 185)", "cherry": "rgb(222, 49, 99)",
    "rose": "rgb(255, 228, 225)", "skyblue": "rgb(135, 206, 235)",
    "orchid": "rgb(218, 112, 214)", "azure": "rgb(0, 127, 255)",
    "lavender": "rgb(255, 240, 245)", "zircon": "rgb(222, 227, 227)"
};

/**
 * 映射修饰符名称到 ANSI 转义码
 */
const ansi_mark = {
    "bold": 1, "dim": 2, "italic": 3, "underline": 4, "blink": 5,
    "inverse": 7, "hidden": 8, "strikethrough": 9
};

/**
 * 键值与键名对调的 ansi_color 对象
 */
const ansi_color_inverted = invert_object(ansi_color);

/**
 * 键值与键名对调的 extra_color 对象
 */
const extra_color_inverted = invert_object(extra_color);

/**
 * 键值与键名对调的 ansi_mark 对象
 */
const ansi_mark_inverted = invert_object(ansi_mark);


/**
 * 重置颜色 ANSI 转义序列
 */
const ansi_reset = "\x1b[0m";

/**
 * 用于提取 ANSI 转义序列的正则表达式
 */
const regexp = {
    "ansi": {
        "match": /\x1b\[[\d;]*m[^\x1b]*\x1b\[0m|[^\x1b]+/g,
        "split": /^\x1b\[([\d;]*)m([^\x1b]*)\x1b\[0m$/
    }
};

/** 
 * 默认的 ANSI 解析时格式
 * 
 * @type {ANSISequenceTextUnit}
 */
const ansi_unit_default = {
    "text": null,
    "mark": null,
    "color": {
        "foreground": null,
        "background": null
    }
};

/**
 * ANSI 256 色的 RGB 映射
 */
const ansi_rgb = [ 0, 95, 135, 175, 215, 255 ];

/**
 * ANSI 标准色
 */
const asni_std_color = [
    [ 0, 0, 0 ],        // 黑色
    [ 205, 0, 0 ],      // 红色
    [ 0, 205, 0 ],      // 绿色
    [ 205, 205, 0 ],    // 黄色
    [ 0, 0, 205 ],      // 蓝色
    [ 205, 0, 205 ],    // 品红
    [ 0, 205, 205 ],    // 青色
    [ 255, 255, 255 ],  // 白色
    [ 85, 85, 85 ],     // 亮黑色
    [ 255, 85, 85 ],    // 亮红色
    [ 85, 255, 85 ],    // 亮绿色
    [ 255, 255, 85 ],   // 亮黄色
    [ 85, 85, 255 ],    // 亮蓝色
    [ 255, 85, 255 ],   // 亮品红
    [ 85, 255, 255 ],   // 亮青色
    [ 255, 255, 255 ]   // 亮白色
];

/**
 * 取得颜色对应的 ANSI 代码
 * 
 * @param {string} color 需要解析的颜色字符串
 * @param {("background"|"foreground")} occasion 使用此颜色所处于的场合
 * 
 * @returns {number[]} 解析出来的颜色对应的颜色代码
 */
function parse_color_string(color, occasion = "background") {
    let code = [];

    if (ansi_color[color]) {
        let offest = occasion == "background" ? 10 : 0;

        code.push(ansi_color[color] + offest);

        return code;
    }

    let prefix = occasion == "background" ? 48 : 38;

    if (typeof color === "number") {
        let [ red, green, blue ] = parse_256_color(color);

        color = `rgb(${red}, ${green}, ${blue})`;
    }

    if (extra_color[color]) {
        color = extra_color[color];
    }

    if (color.startsWith("rgb")) {
        let component = color.match(/rgb\s*\((.*)\)/);

        if (component) {
            component = component[1].split(/\s*,\s*/);

            code.push(prefix, 2, ...component);
        }
    }

    return code;
}

/**
 * 解析 ANSI 256 色成 RGB 颜色
 * 
 * @param {number} code 需要解析的 ANSI 256 颜色代码
 * 
 * @returns {number[]} RGB 颜色分量数组
 */
function parse_256_color(code) {
    if (code >= 0 && code <= 15) {
        return asni_std_color[code];
    }

    if (code >= 16 && code <= 231) {
        let red = Math.floor((code - 16) / 36),
            green = Math.floor(((code - 16) % 36) / 6),
            blue = (code - 16) % 6;

        return [
            ansi_rgb[red], ansi_rgb[green], ansi_rgb[blue]
        ];
    }

    if (code >= 232 && code <= 255) {
        let component = (code - 232) * 10 + 8;

        return [
            component, component, component
        ];
    }
}

/**
 * 将 TextUnit 编码为成符合 ANSI 标准的嵌入文本的描述序列
 * 
 * @param {ANSISequenceTextUnit} unit 需要编码的 TextUnit 列表
 * 
 * @returns {string} 编码出来的符合 ANSI 标准的嵌入文本的描述序列
 */
function parse_text_unit(unit) {
    let code = [];

    if (unit.mark) {
        if (typeof unit.mark === "string") {
            unit.mark = [ unit.mark ];
        }

        unit.mark.map((name) => {
            if (ansi_mark[name]) {
                code.push(ansi_mark[name])
            }
        })
    }

    if (unit.color) {
        let { foreground, background } = unit.color;

        if (foreground) {
            code.push(
                ...parse_color_string(foreground, "foreground")
            );
        }

        if (background) {
            code.push(
                ...parse_color_string(background, "background")
            );
        }
    }

    if (code.length === 0) {
        return unit.text;
    }

    return `\x1b[${code.join(";")}m${unit.text}${ansi_reset}`;

}

/**
 * 解析符合 ANSI 标准的序列文本为 TextUnit 对象
 * 
 * @param {string} sequence 解析符合 ANSI 标准的序列文本
 * 
 * @returns {ANSISequenceTextUnit} 解析后生成的 TextUnit 对象
 */
function parse_sequence(sequence) {
    let match = sequence.match(regexp.ansi.split);

    if (!match) {
        throw new Error(`'${sequence}' 不符合 ANSI 标准所规定的序列文本`);
    }

    let [
        _full_match, code_list, raw_text
    ] = match, modifier = code_list.split(";").map((item) => {
        return Number(item);
    });

    /** @type {ANSISequenceTextUnit} */
    let unit = deep_clone({
        ...ansi_unit_default,
        "text": raw_text,
        "mark": []
    });

    for (let index = 0; index < modifier.length; index++) {
        let current = modifier[index];

        if (current >= 30 && current <= 37) {
            unit.color.foreground = ansi_color_inverted[current];
        }

        if (current >= 40 && current <= 47) {
            unit.color.background = ansi_color_inverted[current - 10];
        }

        if ([ 38, 48 ].includes(current)) {
            let mode = modifier[index + 1],
                occasion = current === 38 ? "foreground" : "background";

            index++;

            if (mode === 2) {
                let color = `rgb(${modifier[index + 1]}, ${modifier[index + 2]}, ${modifier[index + 3]})`;
                let result = extra_color_inverted[color];

                index += 3;
                unit.color[occasion] = result || color;
            }

            if (mode === 5) {
                let [ red, green, blue ] = parse_256_color(modifier[index + 1]);

                index += 1;
                unit.color[occasion] = `rgb(${red}, ${green}, ${blue})`;
            }
        }

        if (Object.values(ansi_mark).includes(current)) {
            let key = ansi_mark_inverted[current];

            if (key) {
                unit.mark.push(key);
            }
        }
    }

    if (unit.mark.length === 1) {
        unit.mark = unit.mark[0];
    }

    if (unit.mark.length === 0) {
        unit.mark = null;
    }

    return unit;
}

/**
 * 将 TextUnit 编码为成符合 ANSI 标准的嵌入文本的描述序列
 * 
 * @param {((ANSISequenceTextUnit|string)[]|string|ANSISequenceTextUnit)} list 需要编码的 TextUnit 列表
 * 
 * @returns {string} 编码出来的符合 ANSI 标准的嵌入文本的描述序列
 */
export function encode(list) {
    let result = "";

    if (!Array.isArray(list)) {
        list = [list];
    }

    for (let index = 0; index < list.length; index++) {
        let current = list[index];

        if (typeof current !== "object") {
            result += to_string(current);

            continue;
        }

        result += parse_text_unit(current);
    }

    return result;
}

/**
 * 将符合 ANSI 标准的嵌入文本的描述序列解码为 TextUnit 列表
 * 
 * @param {string} text 符合 ANSI 标准的嵌入文本的描述序列
 * 
 * @returns {ANSISequenceTextUnit[]} 解码出来的 TextUnit 列表
 */
export function decode(text) {
    /** @type {ANSISequenceTextUnit[]} */
    let sequence = [], match = Array.from(text.matchAll(regexp.ansi.match)).map((item) => {
        return item[0];
    });

    for (let index = 0; index < match.length; index++) {
        let current = match[index];

        if (regexp.ansi.split.test(current)) {
            sequence.push(parse_sequence(
                current
            ));

            continue;
        }

        sequence.push(deep_clone({
            ...ansi_unit_default,
            "text": current
        }));
    }

    return sequence;
}

/**
 * 将符合 ANSI 标准的嵌入文本的描述序列中的文本单独提取出来
 * 
 * @param {string} text 符合 ANSI 标准的嵌入文本的描述序列
 * 
 * @returns {string} 文本单独提取出来并拼接的结果
 */
export function strip(text) {
    let list = decode(text);

    return list.map((item) => {
        return item.text;
    }).join("");
}

export default {
    "inner": {
        "parser": {
            "sequence": parse_sequence,
            "unit_text": parse_text_unit,
            "256_color": parse_256_color
        }
    },
    "strip": strip,
    "decode": decode,
    "encode": encode
};