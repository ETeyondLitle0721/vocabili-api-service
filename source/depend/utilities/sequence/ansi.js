import { deep_clone, invert_object, to_string } from "../../toolkit.js";

/**
 * 映射颜色名称到 ANSI 转义码（展示的是背景色，前景色需要加十）
 */
const ansi_color = {
    "black": 30, "red": 31, "green": 32, "yellow": 33, "blue": 34, "magenta": 35,
    "cyan": 36, "white": 37, "gray": 90, "black-bright": 90, "red-bright": 91,
    "green-bright": 92, "yellow-bright": 93, "blue-bright": 94, "magenta-bright": 95,
    "cyan-bright": 96, "white-bright": 97
};

/**
 * 额外扩展颜色（仅展示了部分颜色）
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
    "zircon": "rgb(222, 227, 227)", "navy": "rgb(0, 0, 128)",
    "olive": "rgb(128, 128, 0)", "maroon": "rgb(128, 0, 0)",
};

/**
 * 映射修饰符名称到 ANSI 转义码
 */
const ansi_sgr = {
    "set": {
        "reset": 0, "bold": 1, "dim": 2, "italic": 3,
        "underline": 4, "blink": 5, "fast-blink": 6,
        "inverse": 7, "hidden": 8, "strikethrough": 9,
        "overline": 53
    },
    "close": {
        "blod": 21, "underline": 24, "blink": 25,
        "inverse": 27, "hidden": 28, "strikethrough": 29,
        "overline": 55
    }
};

/**
 * 解析文本中的颜色为 ANSI 转义码
 * 
 * @typedef {(keyof ansi_color)} BuiltinColor
 * @typedef {(keyof extra_color)} ExtraColor
 * @typedef {(`rgb(<integer>,<integer>,<integer>)`)} RGBColor
 * 
 * @typedef {(BuiltinColor|ExtraColor|RGBColor)} SupportColor
 * 
 * @param {SupportColor} value 需要解析的颜色字符串
 * @param {("background"|"foreground")} scope 需要解析的颜色的作用域
 * @returns {number[]} 解析后的 ANSI 转义码
 */
function parse_color(value, scope) {
    if (value in ansi_color) {
        const offset = {
            "foreground": 0,
            "background": 10
        } [ scope ];

        const base = ansi_color[value];

        return [ base + offset ];
    }

    value = value.trim().toLowerCase();

    if (!value.includes("(")) {
        value = extra_color[value];
    }

    const prefix = {
        "foreground": 38,
        "background": 48
    } [ scope ];

    const parts = value.match(
        /^rgb\((\d+),(\d+),(\d+)\)$/
    ).slice(1, 4).map((value) => {
        return parseInt(value, 10);
    });

    return [ prefix, 2, ...parts ];
}

/**
 * 解析文本中的修饰符为 ANSI 转义码
 * 
 * @typedef {(keyof ansi_sgr["set"])} SupportStyle
 * 
 * @typedef {(`bg-color:${SupportColor}`)} BackgroundColor
 * @typedef {(`fg-color:${SupportColor}`)} ForegroundColor
 * @typedef {(`text-style:${SupportStyle}`)} TextStyle
 * 
 * @typedef {(BackgroundColor|ForegroundColor|TextStyle)} TextFlag
 * 
 * @param {TextFlag[]} flags 需要解析的修饰符
 * @returns {string} 构建出的 ANSI 转义码
 */
function parse_sgr_flags(flags) {
    const modifier = {
        "bg-color": [],
        "fg-color": [],
        "text-style": []
    };

    for (let index = 0; index < flags.length; index++) {
        let current = flags[index];

        if (current.includes(":")) {
            const parts = current.split(":");

            if (parts[0] === "bg-color") {
                modifier["bg-color"] = parse_color(
                    parts[1], "background"
                );
            }
            
            if (parts[0] === "fg-color") {
                modifier["fg-color"] = parse_color(
                    parts[1], "foreground"
                );
            }
            
            if (parts[0] === "text-style") {
                modifier["text-style"].push(
                    ansi_sgr["set"][parts[1]]
                );
            }
        }
    }

    const values = Object.values(modifier);
    const flat_array = values.flat(2);

    return "\x1b[" + flat_array.join(";") + "m";
}

/**
 * 解析文本中的修饰符为带有 ANSI SGR 转义码的文本
 * 
 * @typedef {Object} PartUnit
 * @property {string} text 需要展示的文本内容
 * @property {TextFlag[]} flags 展示文本期望应用的修饰符
 * 
 * @param {(PartUnit|PartUnit[])} list 需要展示的文本内容
 * @returns {string} 构建出来的带有 ANSI 转义码的文本
 */
export function encode(list) {
    if (!Array.isArray(list)) {
        list = [ list ];
    }

    const result = [], reset = [
        "text-style:reset"
    ];

    const parser = parse_sgr_flags;

    for (let index = 0; index < list.length; index++) {
        const { text, flags } = list[index];

        const array = [
            parser(flags), text, parser(reset)
        ];

        result.push(array.join(""));
    }

    return result.join("");
}

/**
 * @typedef {(`column:<integer>`|`row:<integer>`)} CSIMovePinterWithPosition
 * @typedef {(`dirction:${("up"|"down"|"left"|"right")}`|`distance:<integer>`)} CSIMovePinterWithDirection
 * 
 * @typedef {(CSIMovePinterWithPosition|CSIMovePinterWithDirection)} CSIMovePinterFlags
 * 
 * @typedef {(`distance:<integer>`|`direction:${("up"|"down")}`)} CSIScrollScreenFlags
 * 
 * @typedef {(`type:${("all"|"line")}`)} CSIResetScreenFlags
 * 
 * @typedef {(CSIMovePinterFlags|CSIScrollScreenFlags|CSIResetScreenFlags)} CSIFlags
 * 
 * @typedef {("move-pointer"|"erase-screen"|"scroll-screen")} CSIName
 */

const _printer = process.stdout.write.bind(process.stdout);

/**
 * 向输出设备打印 ANSI CSI 文本
 * 
 * @template {((text: string) => void)} OutputDevice
 * 
 * @param {CSIName} name 需要打印的 CSI 文本的名称
 * @param {CSIFlags[]} flags 需要打印的 CSI 文本的修饰符 
 * @param {OutputDevice} printer 输出设备
 * @returns {ReturnType<OutputDevice>} 调用输出设备的结果
 */
export function print(name, flags = [], printer = _printer) {
    const param = {}, options = {
        "parts": [], "char": ""
    };

    for (let index = 0; index < flags.length; index++) {
        const current = flags[index];

        if (current.includes(":")) {
            const parts = current.split(":");

            const field = parts.slice(0, -1).join(":");

            param[field] = parts.at(-1);
        }
    }

    if (name === "move-pointer") {
        if ("column" in param && "row" in param) {
            options.parts.push(
                param.column, param.row
            );

            options.char = "H";
        }
        
        if ("distance" in param) {
            param.dirction ??= "up";
            param.distance ??= 1;

            const code = {
                "up": "A",
                "down": "B",
                "right": "C",
                "left": "D"
            } [ param.dirction ];

            options.char = code;
            options.parts.push(param.distance);
        }
    }

    if (name === "scroll-screen") {
        param.dirction ??= "up";
        param.distance ??= 1;

        const code = {
            "up": "S",
            "down": "T"
        } [ param.dirction ];

        options.char = code;
        options.parts.push(param.distance);
    }

    if (name === "erase-screen") {
        param.type ??= "all";

        options.parts.push({
            "all": "2",
            "line": "1"
        } [ param.type ]);

        options.char = "J";
    }

    const parts = options.parts.join(";")

    return printer(`\x1b[${parts}${options.char}`);
}

const regex = /(\x1b\[[0-?]*[ -/]*[@-~])/g;

/**
 * 切割文本中的 ANSI 转义码
 * 
 * @param {string} text 需要切割的文本
 * @returns {string[]} 切割出来的文本列表
 */
function split_ansi_text(text) {
    const result = [];

    let match, lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            result.push(text.substring(
                lastIndex, match.index
            ));
        }

        result.push(match[0]);
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        result.push(text.substring(lastIndex));
    }

    return result;
}

/**
 * 解析带有 ANSI SGR 转义码的文本为文本和修饰符
 * 
 * @param {string} text 需要解析的文本
 * @returns {PartUnit[]} 解析出来的文本和修饰符
 */
export function decode(text) {
    const parts = split_ansi_text(text);

    // ...
}

/**
 * 去除文本中的 ANSI 转义码
 * 
 * @param {string} text 需要去除的文本
 * @returns {string} 去除后的文本
 */
export function strip(text) {
    return text.replace(regex, "");
}

export const parse = {
    "sgr": {
        "flags": parse_sgr_flags
    }
};