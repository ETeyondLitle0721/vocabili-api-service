import fs from "fs"; import url from "url"; import path from "path";
import SQLite3 from "better-sqlite3"; import {
    compute_hamc, get_type, text_transformer as cap,
    to_string, classification, unique_array, quote_string
} from "../../depend/core.js";
import DatabaseOperator from "../../depend/operator/database.js";

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

const instance = new SQLite3(database.filepath, {  // 强制使用内存数据库
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
    ), "UTF-8"), result = JSON.parse(
        "[" + content.split("\n").filter(item => item).join(",") + "]"
    );

    console.log(`Read: ${filepath}, Result: ${result.length}`);

    return result;
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
 * 获取当前的 ISO 8601 毫秒级时间字符串
 */
const get_iso_time_text = (instance = new Date()) => instance.toISOString();

const cmp_video = new Set();

/**
 * 在数据库中插入关联视频数据并构建关联关系（使用原始条目数据）
 * 
 * @param {object} data 原始条目数据
 */
function insert_platform(data) {
    const target = {
        "song": gen_id("Song", data.name ?? data.title),
        "video": gen_id("Platform", data.bvid)
    };

    if (cmp_video.has(target.video) || !data.bvid) return;

    memory.platform.set(target.video, {
        "id": target.video, "thumbnail": data.image_url || "没有封面", "page": Math.floor(data.page ?? -1),
        "link": "BB://V/" + data.bvid, "title": data.title ?? data.video_title,
        "copyright": data.copyright ?? -1, "duration": (data.duration && human_duration_to_duration(
            data.duration.replace("分", ":").replace("秒", "")
        )) ?? -1, "uploaded_at": get_iso_time_text(
            new Date(data.pubdate || 0)
        ).replace(/\.\d{3}/, ""), "recorded_at": get_iso_time_text()
    });

    insert_mark({
        "type": "platform",
        "value": target.video,
        "target": target.song
    });

    if (data.page > 0 && data.pubdate) return cmp_video.add(target.video);
}

/**
 * 在数据库中创建标记关系
 * 
 * @param {object} data 决定标记关系的数据
 */
function insert_mark(data) {
    const identifier = gen_id("Record", data.type + data.target + data.value);

    if (!memory.mark.has(identifier)) memory.mark.set(
        identifier, Object.assign(data, {
            "id": identifier, "set_at": get_iso_time_text()
        })
    );
    
    return {
        "_id": identifier, "target": memory.mark
    };
}

const cmp_song = new Set();

/**
 * 在数据库中插入曲目数据（使用原始条目数据）
 * 
 * @param {object} data 原始条目数据
 */
function insert_song(data) {
    const song_id = gen_id("Song", data.name ?? data.title), entries = Object.entries(data);

    if (cmp_song.has(song_id)) return;

    insert_platform(data);

    memory.song.set(song_id, {
        "name": data.name ?? data.title, "type": data.type || "未标记",
        "add_at": get_iso_time_text(), "id": song_id
    });

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index], key = entry[0];
        
        if (!base.list.includes(key)) continue;

        entry[1].toString().split("、").map(name => {
            const field = base.map[key], id = {
                "video": gen_id("Platform", data.bvid),
                "target": gen_id(cap(field), name)
            }, inserted_data = {
                "id": id.target, "name": name,
                "add_at": get_iso_time_text()
            }, marked_data = {
                "type": field,
                "value": id.target,
                "target": song_id
            };

            if (field === "vocalist") inserted_data.color = -1;
            if (field === "uploader") marked_data.target = id.video;

            insert_mark(marked_data);
            memory[field].set(id.target, inserted_data);
        });
    }

    cmp_song.add(song_id)
}

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
            if (data.synthesizer) insert_song(data);
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
        const datetime = filename.slice(0, 8); // YYYYMMDD

        console.log("正在载入 " + datetime + " 的日刊信息");

        dataset.forEach((data, index) => {
            const _id = gen_id("Song", data.name ?? data.title), id = {
                "song": _id, "rank": gen_id(
                    "Record", "vocaloid-daily" + datetime + _id
                )
            };

            memory.rank.set(id.rank, {
                "id": id.rank, "rank": index + 1, "board": "vocaloid-daily",
                "like": -1, "coin": -1, "view": -1, "target": id.song, "count": data.count ?? -1,
                "issue": Number(datetime), "favorite": -1, "view_change": data.view, "point": data.point,
                "like_rank": data.like_rank ?? -1, "view_rank": data.view_rank ?? -1,
                "coin_rank": data.coin_rank ?? -1, "favorite_rank": data.favorite_rank ?? -1,
                "like_change": data.like, "coin_change": data.coin, "platform": gen_id("Platform", data.bvid),
                "favorite_change": data.favorite, "set_at": get_iso_time_text()
            });

            if (!memory.song.has(id.song)) insert_mark({
                "type": "tag", "target": id.song,
                "value": gen_id("Tag", "not-exists")
            });

            insert_song(data), insert_platform(data);
        });
    }
}

/**
 * 在数据库中插入周刊数据
 * 
 * @param {("Weekly-0001"|"Weekly-0002")} format 数据文件版本
 * @param {string} filepath 数据文件路径
 */
function _insert_weekly(format, filepath) {
    if ([ "Weekly-0001", "Weekly-0002" ].includes(format)) {
        const dataset = read_jsonl(filepath), filename = path.basename(filepath);
        const datetime = filename.replaceAll("-", "").replaceAll(".jsonl", ""); // YYYYMMDD

        console.log("正在载入 " + datetime + " 的周刊信息");

        dataset.forEach((data, index) => {
            const _id = gen_id("Song", data.name ?? data.title), id = {
                "song": _id, "rank": gen_id(
                    "Record", "vocaloid-weekly" + datetime + _id
                )
            };

            memory.rank.set(id.rank, {
                "id": id.rank, "rank": index + 1, "board": "vocaloid-weekly",
                "like": -1, "coin": -1, "view": -1, "target": id.song, "count": data.count ?? -1,
                "issue": Number(datetime), "favorite": -1, "view_change": data.view, "point": data.point,
                "like_rank": data.like_rank ?? -1, "view_rank": data.view_rank ?? -1,
                "coin_rank": data.coin_rank ?? -1, "favorite_rank": data.favorite_rank ?? -1,
                "like_change": data.like, "coin_change": data.coin, "platform": gen_id("Platform", data.bvid),
                "favorite_change": data.favorite, "set_at": get_iso_time_text()
            });

            if (format === "Weekly-0002") {
                if (!memory.song.has(id.song)) insert_mark({
                    "type": "tag", "target": id.song,
                    "value": gen_id("Tag", "not-exists")
                });

                insert_song(data), insert_platform(data);
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
        const datetime = `${match[1]}-${match[2]}-${match[3]}`; // YYYY-MM-DD

        console.log("正在载入 " + datetime + " 的快照信息");

        dataset.forEach(data => {
            if (!data.bvid) return;

            const _id = gen_id("Song", data.name ?? data.title);
            const abstract = datetime.replaceAll("-", "") + _id, id = {
                "song": _id, "record": [
                    gen_id("Record", "vocaloid-daily" + abstract),
                    gen_id("Record", "vocaloid-weekly" + abstract)
                ], "snapshot": gen_id("Record", abstract)
            };

            memory.snapshot.set(id.snapshot, {
                "id": id.snapshot, "snapshot_at": datetime, "favorite": data.favorite,
                "like": data.like, "coin": data.coin, "view": data.view, "target": id.song,
                "recorded_at": get_iso_time_text()
            });

            id.record.map(current => {
                const temp = memory.rank.get(current);

                if (!temp || temp.like >= 0) return;

                memory.rank.set(current, Object.assign(
                    temp, {
                        "like": data.like, "view": data.view,
                        "coin": data.coin, "favorite": data.favorite,
                    }
                ));
            });
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
            const identifier = gen_id("Vocalist", data[1]);

            if (!memory.vocalist.has(identifier)) return;

            memory.vocalist.set(identifier, Object.assign(
                memory.vocalist.get(identifier), {
                    "color": Number("0x" + data[0])
                }
            ));
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
    "song": new Map(), "rank": new Map(), "mark": new Map(),
    "platform": new Map(), "vocalist": new Map(),
    "uploader": new Map(), "producer": new Map(),
    "snapshot": new Map(), "synthesizer": new Map()
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

const m_entries = Object.entries(memory);

let total = 0, task = {};

for (let index = 0; index < m_entries.length; index++) {
    const entry = m_entries[index], list = Array.from(entry[1]).map(item => item[1]);

    total += list.length, task[entry[0]] = list;
}

console.log("一共生成了 " + total + " 个条目，正在准备插入数据库");

/**
 * 批量插入数据
 * 
 * @typedef {import("../../depend/operator/database.js").GeneralObject} GeneralObject
 * 
 * @param {string} table_name 需要插入数据的表单的名称
 * @param {GeneralObject[]} data_list 需要插入的数据
 * @param {SQLite3.Database} instance 数据库实例化对象
 */
function bulk_insert(table_name, data_list, instance) {
    const table = quote_string(table_name, "double");
    const sample = Object.keys(data_list[0]);
    const columns = sample.map(item => quote_string(item, "double")).join(", ");
    const placeholders = sample.fill("?").join(", ");

    const statement = instance.prepare(
        `INSERT OR REPLACE INTO ${table} ( ${columns} ) VALUES ( ${placeholders} )`
    );

    instance.transaction((list) => {
        for (const target of list) {
            statement.run(
                Object.values(target)
            );
        }
    })(data_list);
}

instance.pragma("synchronous = OFF");
instance.pragma("journal_mode = WAL");

const operator = new DatabaseOperator(instance);

Object.entries(task).forEach(entry => {
    const table_name = cap(entry[0]) + "_Table";

    console.log(table_name + " 表单正在准备开始插入");

    bulk_insert(
        table_name, entry[1], instance
    );

    console.log(table_name + " 表单插入完毕");
});

console.log("数据条目全部插入完毕");
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
    ).sort();
});

fs.writeFileSync(
    filepath, JSON.stringify(
        content, null, 4
    )
);

console.log("成功更新 ISSUE 定义文件");