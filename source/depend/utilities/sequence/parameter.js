/**
 * 补全一个整数到指定的长度（如果不够就在前面补零）
 * 
 * @param {number} number 需要补零的整数
 * @param {number} length 期望返回的数字字符串的长度 
 * @returns {string} 补零后的数字字符串
 */
const pad_number = (number, length) => {
    const text = number.toString();

    return text.padStart(length, "0");
};

/**
 * 解析带有字段名称的参数序列
 * 
 * @param {string[]} parmas 需要解析的参数序列
 * @param {Object<string, string>} defaults 默认的结果
 * @param {string[]} dfnames 默认的字段名称列表
 * @returns {Object<string, string>} 解析结果
 */
export function parse(parmas, defaults = {}, dfnames = []) {
    const result = structuredClone(defaults);

    const param_list = [];

    for (let index = 0; index < parmas.length; index++) {
        const current = parmas[index].split("=");

        const [ value, field ] = current.reverse();

        if (!field) {
            param_list.push(value);

            continue;
        }

        const fields = field.split(",");
        const values = value.split(",");

        if (values.length === 1) {
            fields.forEach((_, index) => {
                values[index] = values[0];
            });
        }

        for (let index = 0; index < fields.length; index++) {
            const current = fields[index];
            
            const value = values[index] || "";

            param_list.push(`${current}=${value}`);
        }
    }

    for (let index = 0; index < param_list.length; index++) {
        const cursor = pad_number(index + 1, 4);
        const current = param_list[index].split("=");

        const _fname = dfnames[index] || "Field_" + cursor;

        const [ value, field = _fname ] = current.reverse();

        result[field] = value;
    }

    return result;
}