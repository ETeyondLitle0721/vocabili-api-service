import fs from "fs";
import url from "url";
import xlsx from "xlsx";
import path from "path";
import { check_path_accessible, get_type } from "../../depend/core.js";
import TaskProgressReporter from "../../depend/operator/reporter/task.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @callback ReadXlsxTargetCallback
 * @param {string[]} list 目标工作簿中的工作表列表
 * @returns {string} 需要读取的工作表名称
 */

/** @type {({ "input": string, "output": string })[]} */
const manifest = JSON.parse(
    fs.readFileSync(path.resolve(
        __dirname, "./define/manifest/xlsx.json"
    ), "UTF-8")
);

const reporter = new TaskProgressReporter(
    manifest.length, 32, 50, (text, task) => {
        if (task.task.complete === task.task.total) {
            return process.stdout.write(text);
        }

        return process.stdout.write(text + "\r");
    }
);

/**
 * 通过一个需要的读取的 XLSX 的路径读取目标文件的内容
 * 
 * @param {string} filepath 需要读取的目标 XLSX 的文件
 * @param {(index|string|ReadXlsxTargetCallback)} target 要读取的目标工作表
 * @returns {(Object<string, (number|string)>)[]} 读取出来的数据
 */
function read_xlsx(filepath, target = 0) {
    let workbook = xlsx.readFile(filepath), type = get_type(target);

    if (type.first !== "function") {
        if (type.first === "string") {
            let name = target;

            target = () => name;
        }

        if (type.first === "number") {
            let index = target;

            target = (list) => list[index];
        }
    }

    return xlsx.utils.sheet_to_json(
        workbook.Sheets[target(
            workbook.SheetNames
        )]
    );
}

reporter.start("report");

for (let index = 0; index < manifest.length; index++) {
    const current = manifest[index];

    if (!await check_path_accessible(
        path.dirname(current.output)
    )) {
        fs.mkdirSync(path.dirname(current.output), {
            "recursive": true
        });
    }
    
    fs.writeFileSync(
        current.output, read_xlsx(
            current.input, 0
        ).map(item => JSON.stringify(item)).join("\n"), "UTF-8"
    );

    reporter.tick("success", "auto-stop");

    if (reporter.task.complete !== reporter.task.total) {
        reporter.printer(
            reporter.report(), reporter
        );
    }
}