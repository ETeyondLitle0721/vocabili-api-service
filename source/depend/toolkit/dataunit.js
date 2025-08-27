import * as comma from "./comma.js";
import { bigint_divide } from "../toolkit.js";

const base_config = {
    "full": {
        "bit": "Bit",
        "byte": "Byte",

        "binary": [
            "", "Kili", "Mebi", "Gibi", "Tebi",
            "Pebi", "Exbi", "Zebi", "Yobi", "Robi", "Quebi"
        ],

        "decimal": [
            "", "Kilo", "Mega", "Giga", "Tera",
            "Peta", "Exa", "Zetta", "Yotta", "Ronna", "Quetta"
        ]
    },

    "short": {
        "bit": "b",
        "byte": "B",

        "binary": [
            "", "Ki", "Mi", "Gi", "Ti",
            "Pi", "Ei", "Zi", "Yi", "Ri", "Qi"
        ],

        "decimal": [
            "", "K", "M", "G", "T",
            "P", "E", "Z", "Y", "R", "Q"
        ]
    }
};

const _dnamer = (mode, level) => {
    const config = base_config[mode];
    const length = config.decimal.length;

    level -= length - 1;

    const text = level.toString();
    const cursor = text.padStart(2, "0");

    return `UnknownUnit[${cursor}]`;
};

const default_rate_mapping = {
    "base": { "byte": 8n, "bit": 1n },
    "unit": { "binary": 1024n, "decimal": 1000n }
};

const config_generator = {
    /**
     * 获取存储单位配置信息
     * 
     * @typedef {["full"|"short", "binary"|"decimal", "byte"|"bit"]} StorageMode
     * @typedef {{ rate: bigint, name: { singular: string, plural: string } }} GeneralResult
     * 
     * @param {number} level 单位的级别
     * @param {StorageMode} mode 单位的模式
     * @param {(mode: string, level: number) => string} dnamer 自定义单位名称
     * @returns {GeneralResult} 计算结果
     */
    storage(level, mode = [], dnamer = _dnamer) {
        const first = mode[0] ?? "full";
        const second = mode[1] ?? "binary";
        const third = mode[2] ?? "byte";

        const mapping = default_rate_mapping; 

        const rate = {
            "base": mapping.base[third],
            "unit": mapping.unit[second]
        };

        const config = base_config[first];

        const define = config[second][level - 1];

        const name = define ?? dnamer(first, level);

        const suffix = config[third];

        return {
            "rate": rate.base * rate.unit ** BigInt(level - 1),
            "name": {
                "singular": name + suffix,
                "plural": name + suffix + "s"
            }
        };
    },

    /**
     * 获取带宽单位配置信息
     * 
     * @typedef {["full"|"short", "binary"|"decimal", "byte"|"bit", "letter"|"slash"]} BandwidthMode
     * 
     * @param {number} level 带宽的级别
     * @param {BandwidthMode} mode 带宽的模式
     * @param {(mode: string, level: number) => string} dnamer 自定义单位名称
     * @returns {GeneralResult} 计算结果
     */
    bandwidth(level, mode = [], dnamer = _dnamer) {
        const result = this.storage(
            level, mode, dnamer
        );

        const forth = mode[3] || "letter";

        const mapping = {
            "letter": "ps", "slash": "/s"
        };

        const suffix = mapping[forth];

        const singular = result.name.singular + suffix;

        result.name.plural = singular;
        result.name.singular = singular;

        return result;
    }
};

export const format = {
    /**
     * 将比特数转换为便于人类阅读的文本（大小）
     * 
     * @typedef {("real-byte-count")} SuffixPart
     * 
     * @param {(number|bigint)} byte 比特数
     * @param {StorageMode[]} mode 便于人类阅读的文本模式
     * @param {number} [ratio=0.85] 进位时允许的进率缩放最小值
     * @param {number} [precision=3] 单位前面的数字的精度
     * @param {SuffixPart[]} suffix 需要在后方添加的文本
     * @param {number} [scale=15] 运算时的缩放数量级
     * @param {number} [level=1] 初始级别
     * @param {string} [scheme="storage"] 调用的方法名称
     * @returns {string} 便于人类阅读的文本
     */
    storage(
        byte, ratio = 0.85, precision = 3, suffix = [],
        mode = [], scale = 15, level = 1, scheme = "storage"
    ) {
        if (typeof byte === "number") {
            if (!Number.isFinite(byte)) {
                throw new Error(`byte: ${byte} is not a finite number`);
            }

            if (byte < 0) {
                throw new Error(`byte: ${byte} is not a positive number`);
            }

            if (!Number.isInteger(byte)) {
                throw new Error(`byte: ${byte} is not an integer number`);
            }

            if (byte > Number.MAX_SAFE_INTEGER) {
                throw new Error(`byte: ${byte} is too big, please use BigInt value instead`);
            }
        }

        if (!Number.isFinite(ratio)) {
            throw new Error(`ratio: ${ratio} is not a finite number`);
        }

        if (ratio < 0) {
            throw new Error(`ratio: ${ratio} is not a positive number`);
        }

        if (ratio > 1) {
            throw new Error(`ratio: ${ratio} is too big, please ` +
                `match 0 < ratio <= 1`);
        }

        if (!Number.isFinite(precision)) {
            throw new Error(`precision: ${precision} is not a finite number`);
        }

        if (precision < 0) {
            throw new Error(`precision: ${precision} is not a positive number` +
                `, please match 0 < precision <= 1`);
        }

        if (!Number.isInteger(scale)) {
            throw new Error(`scale: ${scale} is not an integer number`);
        }

        if (scale < 0) {
            throw new Error(`scale: ${scale} is not a positive number`);
        }

        if (!Number.isInteger(level)) {
            throw new Error(`level: ${level} is not an integer number`);
        }

        if (level < 0) {
            throw new Error(`level: ${level} is not a positive number`);
        }

        if (typeof byte !== "string") {
            byte = byte.toString();
        }

        const target = BigInt(byte) * 8n;

        const generator = config_generator[scheme]
            .bind(config_generator);

        while (true) {
            const config = generator(
                level, mode, _dnamer
            );

            if (config.rate > target) {
                break;
            }

            level++;
        }

        const n_config = generator(
            level, mode, _dnamer
        );

        const n_value = bigint_divide(
            target, n_config.rate, precision
        );
        
        if (Number(n_value) > ratio) {
            return this[scheme](
                byte, ratio, precision, suffix,
                mode, scale, level + 1
            );
        }

        const c_config = generator(
            level - 1, mode, _dnamer
        );

        const c_value = bigint_divide(
            target, c_config.rate, precision
        );

        const result = [];

        result.push(c_value, " ");

        const _is_1 = (text) => 
            !!text.match(/^1[.0]+$/);

        if (_is_1(c_value)) {
            result.push(c_config.name.singular);
        } else {
            result.push(c_config.name.plural);
        }

        if (suffix.includes("real-byte-count")) {
            const count = comma.add.integer(
                target / 8n, 3, ","
            );

            result.push(" (", count, " ");

            if (count === "1") {
                result.push("Byte");
            } else {
                result.push("Bytes");
            }

            result.push(")");
        }

        return result.join("");
    },

    /**
     * 将比特数转换为便于人类阅读的文本（速率）
     * 
     * @typedef {("real-byte-count")} SuffixPart
     * 
     * @param {(number|bigint)} byte 比特数
     * @param {BandwidthMode} mode 便于人类阅读的文本模式
     * @param {number} [ratio=0.85] 进位时允许的进率缩放最小值
     * @param {number} [precision=3] 单位前面的数字的精度
     * @param {SuffixPart[]} suffix 需要在后方添加的文本
     * @param {number} [scale=15] 运算时的缩放数量级
     * @param {number} [level=1] 初始级别
     * @param {string} [scheme="storage"] 调用的方法名称
     * @returns {string} 便于人类阅读的文本
     */
    bandwidth(
        byte, ratio = 0.85, precision = 3, suffix = [],
        mode = [], scale = 15, level = 1
    ) {
        mode[0] = "short", mode[3] = "slash";

        return this.storage(
            byte, ratio, precision, suffix,
            mode, scale, level, "bandwidth"
        );
    }
};