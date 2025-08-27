import fs from "fs";
import url from "url";
import path from "path";
import define from "../define/directory.json" with { "type": "json" };
import console from "../../../depend/toolkit/console.js";
import * as xlsx from "../../toolkit/dataset/xlsx.js";
import * as dataunit from "../../../depend/toolkit/dataunit.js";

const root = path.resolve(".");

const dirpath = path.resolve(root, define.input.snapshot);

console.tlog(`正在查找 ${define.input.snapshot} 文件夹下的 XLSX 文件....`);

const dirents = fs.readdirSync(dirpath, {
    "recursive": true,
    "withFileTypes": true, 
}).map((dirent) => {
    const filepath = path.resolve(
        dirpath, dirent.name
    );

    return Object.assign(dirent, {
        "filepath": filepath
    });
});

const xlsx_dirents = dirents.filter((dirent) => {
    const filename = path.basename(dirent.filepath);

    return dirent.isFile() && filename.endsWith(".xlsx");
});

console.tlog(`共发现了 ${xlsx_dirents.length} 个 XLSX 文件，正在准备处理...`);

const video_title = {};

async function deal_with_xlsx(filepath, callback) {
    return new Promise((resolve) => {
        xlsx.read(filepath, "Sheet1").then((dataset) => {
            for (let index = 0; index < dataset.length; index++) {
                const { bvid, ...rest } = dataset[index];

                const title = rest.video_title || rest.title;

                if (!title || !bvid) continue;

                video_title[bvid] ??= [];

                const title_list = video_title[bvid];

                if (title_list.at(-1) !== title) {
                    title_list.push(title);
                }
            }

            resolve(callback());
        });
    });
}

const pad_number = (number, length) => {
    const text = number.toString();

    return text.padStart(length ?? 4, "0");
};

const total = pad_number(xlsx_dirents.length, 4);

for (let index = 0; index < xlsx_dirents.length; index++) {
    const dirent = xlsx_dirents[index];
    const cursor = pad_number(index + 1, 4);

    const stat = fs.statSync(dirent.filepath);

    console.tlog(` [${cursor}/${total}] 正在处理 ${dirent.name} 文件 (${
        dataunit.format.storage(stat.size, 0.85, 3)})`);

    await deal_with_xlsx(dirent.filepath, () => console.tlog(
        ` [${cursor}/${total}] 目标文件 ${dirent.name} 处理完成。`
    ));
}

console.tlog("所有需要处理的 XLSX 文件已经处理完成，正在输出结果...");

const output = path.resolve(root, define.output.aggre.platform.title);

fs.writeFileSync(output, JSON.stringify(video_title, null, 4), "UTF-8");

console.tlog("结果输出成功，文件路径为:", `./${
    path.relative(root, output).replaceAll(path.sep, "/")}`);