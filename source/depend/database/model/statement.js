import { depend as gepend } from "../general.js";

/**
 * 构建基础的 CASE 语句
 * 
 * @typedef {Parameters<gepend["build"]["where"]>[0]} CaseWhere
 * 
 * @typedef {Object} CaseOptions
 * @property {any} default 当所有条件都不满足时的默认值
 * @property {ReturnType<gepend["inner"]["getter"]>} getter 可以使用的 SequenceGetter 函数
 * @property {ReturnType<gepend["inner"]["setter"]>} setter 可以使用的 SequenceSetter 函数
 * 
 * @param {{ "where": CaseWhere, "value": any }[]} values 构建 CASE 语句的配置集合
 * @param {CaseOptions} options 构建语句时使用的配置
 * @returns {string} 构建 CASE 返回语句和参数
 */
function _case(values, options = {
    "getter": gepend.inner.getter(),
    "setter": gepend.inner.setter()
}) {
    const { placeholder } = gepend.build;

    const { getter, setter } = options;

    const results = [ "CASE" ], indent = "    ";

    for (let index = 0; index < values.length; index++) {
        const current = values[index];

        const when = gepend.build.where(
            current.where, setter, getter
        );

        const then = placeholder(
            current.value, getter(), setter
        );

        results.push(indent + `WHEN ${when} THEN ${then}`);
    }

    if ("default" in options) {
        results.push(indent + `ELSE ${placeholder(
            options.default, getter(), setter
        )}`);
    }

    results.push("END");

    return results.join("\n");
}

export { _case as case };

export const abstract = {
    "case": {
        /**
         * 构建 CASE 语句（单字段固定值映射）
         * 
         * @param {string} column 需要构建 CASE 语句的列
         * @param {Object<string, any>} mapping 数值映射关系
         * @param {CaseOptions} options 构建语句时使用的配置
         * @returns {string} 构建 CASE 返回语句和参数
         */
        "single": (column, mapping, options) => {
            const values = [], entries = Object.entries(mapping);

            for (let index = 0; index < entries.length; index++) {
                const [ key, value ] = entries[index];

                const where = {
                    "column": column,
                    "restrict": {
                        "include": [ key ]
                    }
                };
                
                values.push({ where, value });
            }

            return _case(values, options);
        }
    }
};