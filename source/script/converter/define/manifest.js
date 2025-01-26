import fs from "fs";
import url from "url";
import path from "path";

const __dirname = path.filename(url.fileURLToPath(import.meta.url));

const root = path.resolve(".");
const target = path.resolve(
    __dirname, "../data/"
);
const output = {
    "manifest": path.resolve(
        __dirname, "./manifest/xlsx.json"
    ),
    "directory": path.resolve(
        "./assets/dataset/"
    )
};
const buffer = [];

const list = fs.readdirSync(target, {
    "encoding": "UTF-8",
    "recursive": true,
    "withFileTypes": true
});

for (let index = 0; index < list.length; index++) {
    const dirent = list[index];
    
    if (dirent.isDirectory()) continue;

    dirent.filepath = dirent.parentPath + path.sep + dirent.name;

    buffer.push({
        "input": "./" + path.relative(
            root, dirent.filepath
        ).replaceAll(path.sep, "/"),
        "output": "./" + path.relative(
            root, path.resolve(
                output.directory, path.relative(
                    target, dirent.filepath
                )
            )
        ).replaceAll(path.sep, "/").replace(
            /xlsx$/, "jsonl"
        )
    });
}

fs.writeFileSync(
    output.manifest, JSON.stringify(
        buffer, null, 4
    ), "UTF-8"
);