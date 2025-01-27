import fs from "fs";
import url from "url";
import path from "path";
import SQLite3 from "better-sqlite3";
import format_datetime from "../../depend/toolkit/formatter/datetime.js";
import DatabaseOperator from "../../depend/operator/database.js";
import TaskProgressReporter from "../../depend/operator/reporter/task.js";
import { compute_hamc, get_type, text_transformer as capitalize, to_string, split_group, classification, unique_array } from "../../depend/core.js";

const root = path.resolve(".");
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const config = {
    "init": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/init.json"
        ), "UTF-8")
    ),
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    ),
    "manifest": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/manifest/insert.json"
        ), "UTF-8")
    )
};
const charset = "0123456789qazwsxedcrfvtgbyhnujmikolpQAZWSXEDCRFVTGBYHNUJMIKOLP-_";

const field = config.init.field;

const database = {
    /** @type {string} */
    "filepath": config.global.database.filepath[field]
};

const instance = new SQLite3(database.filepath, {
    "timeout": 1000,
    "readonly": false
});

/**
 * 读取 JSONL 文件为 JSON 数组
 * 
 * @param {string} filepath 需要读取的 JSONL 文件的路径
 * @returns {(Object<string, (number|string)>)[]} 读取出来的数据
 */
function read_jsonl(filepath) {
    const content = fs.readFileSync(path.resolve(
        root, filepath
    ), "UTF-8");

    return JSON.parse(
        "[" + content.split("\n").join(",") + "]"
    );
}

/**
 * 通过一个文本计算出其对应的识别码
 * 
 * @param {string} branch 目标识别码的分支名称
 * @param {string} text 需要计算的文本
 * @returns {string} 构建出来的目标的识别码
 */
function gen_id(branch, text) {
    let num = BigInt("0x" + compute_hamc(
        text.toString(), "MD5", "vocacili-api-service"
    )), output = "";

    const length = BigInt(charset.length);
    
    while (num > 0) {
        output += charset[Number(num % length)], num /= length;
    }

    return branch + ":" + output.slice(0, 10);
}

const base = {
    "map": {
        "vocal": "vocalist",
        "author": "producer",
        "uploader": "uploader",
        "synthesizer": "synthesizer"
    },
    "list": [
        "vocal", "author", "uploader", "synthesizer"
    ]
};

/**
 * 在数据库中插入基础曲目数据
 * 
 * @param {("Base-0001")} format 数据文件版本
 * @param {string} filepath 数据文件路径
 */
function _insert_base(format, filepath) {
    if (format === "Base-0001") {
        const dataset = read_jsonl(filepath);

        dataset.map(data => {
            const song_id = gen_id("Song", data.name);

            if (!data.vocalist) return;

            memory.song.set(song_id, {
                "id": song_id, "name": data.name, "type": data.type,
                "page": 1, "cover": data.image_url, "duration": -1,
                "link": "https://www.bilibili.com/video/" + data.bvid,
                "title": data.title, "copyright": data.copyright,
                "uploaded_at": format_datetime(
                    "{{year, 4}}-{{month, 2}}-{{day, 2}}T{{hour, 2}}:{{minute, 2}}:{{second, 2}}Z",
                    new Date(data.pubdate), "UTC"
                )
            });

            const entries = Object.entries(data);

            for (let index = 0; index < entries.length; index++) {
                const entry = entries[index], key = entry[0];
                
                if (base.list.includes(key)) {
                    entry[1].toString().split("、").map(name => {
                        const field = base.map[key], id = gen_id("Record", Math.random().toString());

                        memory.mark.set(id, {
                            "id": id, "type": field, "target": song_id,
                            "value": gen_id(capitalize(field), name),
                            "set_at": new Date().toISOString()
                        });

                        memory[field].set(id, {
                            "id": gen_id(capitalize(field), name),
                            "name": name, "added_at": new Date().toISOString()
                        });
                    });
                }
            }
        });
    }
}

/**
 * 将易于人类理解的时长（45, 2:12, 13:14:14）转换成易于计算机理解的时长
 * 
 * @param {string} human_duration 需要转换的人类易于理解的时长
 * @returns {number} 计算机容易理解的时长
 */
function human_duration_to_duration(human_duration) {
    let part = human_duration.split(/:0{0,1}/), result = 0;

    for (let index = part.length - 1; index >= 0; index--) {
        result += Number(part[index]) * 60 ** (part.length - index - 1);
    }

    return result;
}

/**
 * 在数据库中插入周刊数据
 * 
 * @param {("Daily-0001")} format 数据文件版本
 * @param {string} filepath 数据文件路径
 */
function _insert_daily(format, filepath) {
    if (format === "Daily-0001") {
        const dataset = read_jsonl(filepath), filename = path.basename(filepath);
        const issue = Number(filename.slice(0, 8));

        console.log("正在载入 " + issue + " 的日刊信息");

        dataset.map((data, index) => {
            const id = gen_id("Record", "vocaloid-daily" + to_string(issue) + data.bvid);

            memory.rank.set(id, {
                "id": id, "rank": index + 1, "board": "vocaloid-daily",
                "like": data.like, "coin": data.coin, "view": data.view,
                "issue": issue, "favorite": data.favorite,
                "like_rank": data.like_rank, "view_rank": data.view_rank,
                "coin_rank": data.coin_rank, "favorite_rank": data.favorite_rank,
                "target": gen_id("Song", data.name),
                "set_at": new Date().toISOString()
            });
        });
    }
}

const completed = [];

/**
 * 在数据库中插入周刊数据
 * 
 * @param {("Weekly-0001"|"Weekly-0002")} format 数据文件版本
 * @param {string} filepath 数据文件路径
 */
function _insert_weekly(format, filepath) {
    if ([ "Weekly-0001", "Weekly-0002" ].includes(format)) {
        const dataset = read_jsonl(filepath), filename = path.basename(filepath);
        const issue = Number(filename.replaceAll("-", "").replaceAll(".jsonl", ""));

        console.log("正在载入 " + issue + " 的周刊信息");

        dataset.map((data, index) => {
            const id = gen_id("Record", "vocaloid-weekly" + to_string(issue) + data.bvid);

            memory.rank.set(id, {
                "id": id, "rank": index + 1, "board": "vocaloid-weekly",
                "like": data.like, "coin": data.coin, "view": data.view,
                "issue": issue, "favorite": data.favorite,
                "target": gen_id("Song", data.name),
                "like_rank": data.like_rank, "view_rank": data.view_rank,
                "coin_rank": data.coin_rank, "favorite_rank": data.favorite_rank,
                "set_at": new Date().toISOString()
            });

            if (format === "Weekly-0002") {
                const id = gen_id("Song", data.name);

                if (!completed.includes(id)) {
                    completed.push(id);

                    if (memory.song.has(id)) {
                        memory.song.set(id, Object.assign(
                            memory.song.get(id), {
                                "page": data.page,
                                "duration": human_duration_to_duration(
                                    data.duration.replace("分", ":").replace("秒", "")
                                )
                            }
                        ));
                    } else {
                        const entries = Object.entries(data);

                        const song_id = gen_id("Song", data.name);

                        memory.song.set(song_id, {
                            "id": song_id, "name": data.name, "type": data.type,
                            "page": data.page, "cover": data.image_url, "duration": human_duration_to_duration(
                                data.duration.replace("分", ":").replace("秒", "")
                            ),
                            "link": "https://www.bilibili.com/video/" + data.bvid,
                            "title": data.title, "copyright": data.copyright,
                            "uploaded_at": format_datetime(
                                "{{year, 4}}-{{month, 2}}-{{day, 2}}T{{hour, 2}}:{{minute, 2}}:{{second, 2}}Z",
                                new Date(data.pubdate), "UTC"
                            )
                        });

                        memory.mark.set(
                            gen_id("Record", Math.random().toString()), {
                                "id": gen_id("Record", Math.random().toString()), "type": "tag", "target": song_id,
                                "value": "deleted", "set_at": new Date().toISOString()
                            }
                        );

                        for (let index = 0; index < entries.length; index++) {
                            const entry = entries[index], key = entry[0];
                            
                            if (base.list.includes(key)) {
                                entry[1].toString().split("、").map(name => {
                                    const field = base.map[key], id = gen_id("Record", Math.random().toString());

                                    memory.mark.set(id, {
                                        "id": id, "type": field, "target": song_id,
                                        "value": gen_id(capitalize(field), name),
                                        "set_at": new Date().toISOString()
                                    });

                                    memory[field].set(id, {
                                        "id": gen_id(capitalize(field), name),
                                        "name": name, "added_at": new Date().toISOString()
                                    });
                                });
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * 在数据库中插入周刊数据
 * 
 * @param {("Snapshot-0001"|"Snapshot-0002")} format 数据文件版本
 * @param {string} filepath 数据文件路径
 */
function _insert_snapshot(format, filepath) {
    if ([ "Snapshot-0001", "Snapshot-0002" ].includes(format)) {
        const dataset = read_jsonl(filepath), filename = path.basename(filepath);
        const match = filename.match(/(\d{4})(\d{2})(\d{2})/);
        const date = `${match[1]}-${match[2]}-${match[3]}`;

        console.log("正在载入 " + filename.slice(0, 8) + " 的快照信息");

        dataset.map(data => {
            if (!data.name) return;

            if (data.bvid) {
                const id = gen_id("Record", data.bvid + filename.slice(0, 8));

                memory.snapshot.set(id, {
                    "id": id, "recorded_at": date, "favorite": data.favorite,
                    "like": data.like, "coin": data.coin, "view": data.view,
                    "target": gen_id("Song", data.name)
                });

                ([
                    gen_id("Record", "vocaloid-daily" + filename.slice(0, 8) + data.bvid),
                    gen_id("Record", "vocaloid-weekly" + filename.slice(0, 8) + data.bvid)
                ]).map(current => {
                    if (memory.rank.has(current)) {
                        memory.rank.set(current, Object.assign(
                            memory.rank.get(current), {
                                "favorite": data.favorite, "like": data.like,
                                "coin": data.coin, "view": data.view
                            }
                        ));
                    }
                });
            }
        });
    }
}

/**
 * 在数据库中更新歌手代表色数据
 * 
 * @param {("Color-0001")} format 数据文件版本
 * @param {string} filepath 数据文件路径
 */
function _insert_color(format, filepath) {
    if (format === "Color-0001") {
        const dataset = JSON.parse(
            fs.readFileSync(path.resolve(
                root, filepath
            ), "UTF-8")
        );

        console.log("正在为歌手更新代表色数据项");

        dataset.map(data => {
            const color = Number("0x" + data[0]), id = gen_id("Vocalist", data[1]);

            if (memory.vocalist.has(id)) {
                memory.vocalist.set(id, Object.assign(
                    memory.vocalist.has(id), {
                        "color": color
                    }
                ));
            }
        });
    }
}

/**
 * 获取所有数据条目插入器
 * 
 * @returns 获取到的数据条目插入器
 */
function get_inserter() {
    return {
        "base": _insert_base,
        "color": _insert_color,
        "daily": _insert_daily,
        "weekly": _insert_weekly,
        "snapshot": _insert_snapshot
    };
}

const name_mapping = {
    "base": "曲目基础数据",
    "color": "歌手代表色数据",
    "daily": "日刊数据",
    "weekly": "周刊数据",
    "snapshot": "统计量快照数据"
};

/**
 * 通过配置文件处理插入项目
 * 
 * @param {("base"|"color"|"daily"|"weekly"|"snapshot")} type 目标配置文件类别
 * @param {object} config 配置文件
 */
function _process(type, config = {}) {
    const inserter = get_inserter();

    if (get_type(config).first !== "array") {
        config = [ config ];
    }

    for (let index = 0; index < config.length; index++) {
        const options = config[index];

        if (get_type(options.filepath).second !== "array") {
            options.filepath = [ options.filepath ];
        }

        console.log("正在插入" + name_mapping[type]);

        options.filepath.sort().map(filepath => {
            inserter[type](
                options.format, filepath
            );
        });
    }
}

const support = [
    "base", "daily", "weekly", "snapshot", "color"
];

const entries = Object.entries(config.manifest);

const memory = {
    "song": new Map(),
    "rank": new Map(),
    "mark": new Map(),
    "vocalist": new Map(),
    "uploader": new Map(),
    "producer": new Map(),
    "snapshot": new Map(),
    "synthesizer": new Map()
};

for (let index = 0; index < entries.length; index++) {
    const current = entries[index];

    if (support.includes(current[0])) {
        if (get_type(current[1]).second !== "array") {
            current[1] = [ current[1] ];
        }
        
        current[1].map(item => {
            _process(current[0], item);
        });
    }
}

instance.exec("BEGIN");

const operator = new DatabaseOperator(instance);

const m_entries = Object.entries(memory);

let total = 0, task = {};

for (let index = 0; index < m_entries.length; index++) {
    const entry = m_entries[index], list = Array.from(entry[1]).map(item => item[1]);

    total += list.length, task[entry[0]] = list;
}

console.log("一共生成了 " + total + " 个条目，正在准备插入数据库");

const reporter = new TaskProgressReporter(total, 32, 500, (text, task) => {
    if (task.task.complete === task.task.total) {
        return process.stdout.write(text);
    }

    return process.stdout.write(text + "\r");
});

reporter.start("report");

Object.entries(task).map(entry => {
    split_group(
        entry[1], 3000
    ).map(list => {
        operator.insert_item(capitalize(entry[0]) + "_Table", {
            "flag": "if-not-exists",
            "target": list
        });

        reporter.task.complete += list.length - 1;

        reporter.tick("success", "auto-stop");

        if (reporter.task.complete !== reporter.task.total) {
            reporter.printer(
                reporter.report(), reporter
            );
        }
    });
});

instance.exec("COMMIT");

console.log("正在尝试更新 ISSUE 定义文件");

const result = classification(
    operator.select_item("Rank_Table", {
        "source": {
            "select": "all"
        }
    }), (value) => {
        return value.board;
    }
);

const filepath = path.resolve(
    __dirname, "../service/define/default.json"
), content = JSON.parse(
    fs.readFileSync(filepath, "UTF-8")
);

Object.entries(result).map(([key, list]) => {
    content.metadata.board[key].list.issue.default = unique_array(
        list.map(item => item.issue)
    );
});

fs.writeFileSync(
    filepath, JSON.stringify(
        content, null, 4
    )
);

console.log("成功");