import fs from "fs/promises";
import xlsx from "xlsx";

/**
 * 从 Buffer 对象中读取 XLSX 文件的内容
 * 
 * @callback ReadXlsxTargetCallback
 * @param {string[]} list 目标工作簿中的工作表列表
 * @returns {string} 需要读取的工作表名称
 * 
 * @param {Buffer} buffer XLSX 文件的 Buffer 对象
 * @param {(number|string|ReadXlsxTargetCallback)} target 要读取的目标工作表
 * @returns {(Object<string, (number|string)>)[]} 读取出来的数据
 */
function _read(buffer, target) {
    const workbook = xlsx.read(
        buffer, { "type": "buffer" }
    );

    if (typeof target !== "function") {
        const type = typeof target;

        if (type === "string") {
            const name = target;

            target = () => name;
        }

        if (type === "number") {
            const index = target;

            target = (list) => {
                return list[index];
            };
        }
    }

    const sheet_name = target(
        workbook.SheetNames
    );

    return xlsx.utils.sheet_to_json(
        workbook.Sheets[sheet_name]
    );
}

/**
 * 通过一个需要的读取的 XLSX 的路径读取目标文件的内容
 * 
 * @param {string} filepath 需要读取的目标 XLSX 的文件
 * @param {Parameters<_read>[1]} target 要读取的目标工作表
 * @returns {Promise<ReturnType<_read>>} 读取 XLSX 文件得出的数据
 */
export async function read(filepath, target = 0) {
    const _executor = (resolve, reject) => {
        fs.readFile(filepath).then((buffer) =>
            resolve(_read(buffer, target))
        ).catch(reject);
    };

    return new Promise(_executor);
}