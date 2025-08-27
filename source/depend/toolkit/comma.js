export const add = {
    /**
     * 为整数添加数字分隔符
     * 
     * @param {number} number 需要添加数字分隔符的整数
     * @param {number} [length=3] 间隔的数字长度
     * @param {string} [separator=","] 数字分隔符使用的字符
     * @returns {string} 添加了分隔符的字符串
     */
    integer(number, length = 3, separator = ",") {
        if (typeof number === "number") {
            if (!isFinite(number)) {
                throw new Error(`number: ${number} is not a finite number`);
            }

            if (number > Number.MAX_SAFE_INTEGER) {
                throw new Error(`number: ${number} is too big, please use BigInt value instead`);
            }
        }

        if (!Number.isFinite(length)) {
            throw new Error(`length: ${length} is not a finite number`);
        }

        if (length < 1) {
            throw new Error(`length: ${length} is less than 1`);
        }

        if (!Number.isInteger(length)) {
            throw new Error(`length: ${length} is not an integer number`);
        }

        const build_regex = (length) => {
            const rawtext = String.raw;
            const text = rawtext`\B(?=(\d{${length}})+(?!\d))`;

            return new RegExp(text, "g");
        };

        const text = number.toString();

        if (text.includes(".")) {
            length = { "integer": length };
            separator = { "integer": separator };

            return this.decimal(
                number, 3, length, separator
            );
        }

        if (text.startsWith("-")) {
            return "-" + this.integer(
                text.slice(1), length, separator
            );
        }

        const result = text.replace(
            build_regex(length), separator
        );

        return result;
    },

    /**
     * 为小数添加数字分隔符
     * 
     * @typedef {object} LengthConfig
     * @property {number} [integer=3] 整数部分的分隔长度
     * @property {number} [decimal=3] 小数部分的分隔长度
     * 
     * @typedef {object} SeparatorConfig
     * @property {string} [integer=","] 整数部分的分隔符
     * @property {string} [decimal=" "] 小数部分的分隔符
     * @property {string} [spliter="."] 整数部分和小数部分的分隔符
     * 
     * @param {number} number 需要添加数字分隔符的小数
     * @param {number} [precision=3] 小数点后的位数
     * @param {LengthConfig} [length={}] 间隔的数字长度
     * @param {SeparatorConfig} [separator={}] 数字分隔符使用的字符
     * @returns {string} 添加了分隔符的字符串
     */
    decimal(number, precision = 3, length = {}, separator = {}) {
        if (typeof number === "number") {
            if (!isFinite(number)) {
                throw new Error(`number: ${number} is not a finite number`);
            }

            if (number > Number.MAX_SAFE_INTEGER) {
                throw new Error(`number: ${number} is too big, please use BigInt value instead`);
            }
        }

        if (!Number.isFinite(precision)) {
            throw new Error(`precision: ${precision} is not a finite number`);
        }

        if (precision < 0) {
            throw new Error(`precision: ${precision} is less than 0`);
        }

        if (!Number.isInteger(precision)) {
            throw new Error(`precision: ${precision} is not an integer number`);
        }

        length.integer ??= 3;
        length.decimal ??= 3;
        separator.integer ??= ",";
        separator.decimal ??= " ";
        separator.spliter ??= ".";

        /** @type {string} */
        const text = number.toString();
        const parts = text.split(".");

        const integer = this.integer(
            parts[0], length.integer, separator.integer
        );

        if (!parts[1] || !precision) return integer;

        if (parts[1].length >= precision) {
            parts[1] = parts[1].slice(0, precision);
        } else {
            parts[1] = parts[1].padEnd(precision, "0");
        }

        const reverse = (text) => text.split("").reverse().join("");

        const decimal = reverse(add_comma_for_integer(
            reverse(parts[1]), length.decimal, separator.decimal
        ));

        return `${integer}${separator.spliter}${decimal}`;
    }
};