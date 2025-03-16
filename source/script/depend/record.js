import fs from "fs";
import path from "path";

const root = path.resolve(".");

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    )
};

/**
 * 在目标文件的未知末尾追加新内容（如果文件所处的目录不存在则递归创建）
 * 
 * @param {string} filepath 目标文件的绝对路径
 * @param {string} content 需要追加的新内容
 * @returns {fs.StatsFs} 追加完成后的文件统计信息
 */
function append_file(filepath, content) {
    if (!fs.existsSync(filepath)) {
        const dirpath = path.dirname(filepath);

        fs.mkdirSync(dirpath, { recursive: true });
    }

    fs.appendFileSync(filepath, content);

    return fs.statSync(filepath);
}

/**
 * 尝试在脚本的执行记录文件中追加新的记录（先检查配置文件中是否需要记录）
 * 
 * @param {string} name 需要记录的脚本的名称
 * @returns {fs.StatsFs} 追加记录完成后的文件统计信息
 */
export function record(name) {
    if (!config.global.history.record.script[name]) {
        return; // 不记录
    }

    const filepath = path.resolve(
        root, config.global.history.filepath.script[name]
    ); // 强制转换为绝对路径

    const content = JSON.stringify({
        "time": new Date().toISOString(), // ISO 8601
        "command": [
            "node", "./" + path.relative(
                root, process.argv[1]
            ).replaceAll(path.sep, "/"),
            ...process.argv.slice(2)
        ].join(" ")
    });

    return append_file(filepath, `${content}\n`);
}