import fs from "fs"; import url from "url"; import xlsx from "xlsx"; import path from "path";
import SQLite3 from "better-sqlite3"; import { command_parser } from "../depend/parse.js";
import { compute_hamc, get_type, quote_string, split_group, text_transformer as cap, append_rank_field, classification, unique_array } from "../../depend/core.js";
import DatabaseOperator from "../../depend/operator/database.js";

const root = path.resolve("."), shell = command_parser(process.argv);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * @typedef {import("../../depend/operator/database.js").GeneralObject} GeneralObject
 */

const field = shell.field || "default";

const config = {
    "global": JSON.parse(
        fs.readFileSync(path.resolve(
            root, "./config.json"
        ), "UTF-8")
    ),
    "manifest": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/insert.json"
        ), "UTF-8")
    )
};

const database = {
    "filepath": config.global.database[field].filepath
};
const charset = "0123456789qazwsxedcrfvtgbyhnujmikolpQAZWSXEDCRFVTGBYHNUJMIKOLP-_";

const instance = new SQLite3(database.filepath, { 
    "timeout": 1000, "readonly": false
});

/**
 * 通过一个需要的读取的 XLSX 的路径读取目标文件的内容
 * 
 * @callback ReadXlsxTargetCallback
 * @param {string[]} list 目标工作簿中的工作表列表
 * @returns {string} 需要读取的工作表名称
 * 
 * @param {string} filepath 需要读取的目标 XLSX 的文件
 * @param {(index|string|ReadXlsxTargetCallback)} target 要读取的目标工作表
 * @returns {(Object<string, (number|string)>)[]} 读取出来的数据
 */
function read_xlsx(filepath, target = 0) {
    const workbook = xlsx.readFile(filepath), type = get_type(target);

    if (type.first !== "function") {
        if (type.first === "string") {
            const name = target;

            target = () => name;
        }

        if (type.first === "number") {
            const index = target;

            target = (list) => list[index];
        }
    }

    return xlsx.utils.sheet_to_json(
        workbook.Sheets[target(
            workbook.SheetNames
        )]
    );
}

/**
 * 将不包含分隔符的 YYYYMMDD 变成 YYYY分隔符MM分隔符DD 的形式
 * 
 * @param {(string|number)} date_string 需要转换的日期字符串
 * @param {("-"|"/"|" ")} joiner 连接符
 * @param {number[]} date_format 日期分割格式
 * @returns {string} 转换完成的日期字符串
 */
function get_date_string(date_string, joiner = "-", date_format = [ 4, 2, 2 ]) {
    const part = date_string.split("-");

    if (part.length === 1) date_string = date_string.match(/(\d{8})\.(?:xlsx|json)/)[1];
    if (part.length === 2) return date_string.match(/(\d{4}-\d{2})/)[1] + "-01";
    if (part.length === 3) return date_string.match(/(\d{4}-\d{2}-\d{2})/)[1];

    return split_group(
        date_string.toString(), function* () {
            yield* date_format;
        }()
    ).join(joiner);
}

/**
 * 克隆时间对象
 */
Date.prototype.clone = function () {
    const result = new Date(this.getTime());

    result.setHours(0, 0, 0, 0);

    return result;
};

/**
 * 获取接下来的时间节点
 * 
 * @param {("day"|"week"|"month")} unit 步长单位
 * @param {number} amount 步长数值
 * @returns {Date} 接下来的时间节点
 */
Date.prototype.getNextDate = function (unit, amount = 1) {
    const instance = this.clone();

    if (unit === "day") instance.setDate(instance.getDate() + amount);
    if (unit === "week") instance.setDate(instance.getDate() + amount * 7);
    if (unit === "month") instance.setMonth(instance.getMonth() + amount);

    return instance;
};

/**
 * 获取 YYYY-MM-DD 格式的时间字符串
 * 
 * @returns {string} 转换出来的符合格式的时间字符串
 */
Date.prototype.toDateString = function () {
    const day = String(this.getDate()).padStart(2, "0");
    const year = this.getFullYear();
    const month = String(this.getMonth() + 1).padStart(2, "0");
    
    return `${year}-${month}-${day}`;
};

/**
 * 根据标准信息和打表范围生成列表
 * 
 * @param {{ "mode": ("weekly"|"daily"|"monthly"), "date": string, "issue": number }} standard 基准
 * @param {[ Date, Date ]} range 打表范围
 * @returns { { "issue": number, "range": { "start": string, "finish": string } }[] } 打表结果
 */
function lister(standard, range) {
    const [ start, finish ] = range.map(date => date.clone());
    const { mode, date, issue } = standard, result = [];

    const unit = {
        "weekly": "week",
        "monthly": "month",
        "daily": "day"
    } [ mode ] || "day";

    // 向前搜索
    let offset_backward = 0, backward_date = new Date(date).clone();

    while (backward_date >= start) {
        const finish_date = backward_date.clone();
        const start_date = finish_date.getNextDate(unit, -1);

        const range_start = start_date < start ? start : start_date;
        const range_finish = finish_date > finish ? finish.clone() : finish_date;

        result.push({
            "issue": issue + offset_backward, "range": {
                "start": range_start.toDateString(),
                "finish": range_finish.toDateString()
            }
        });

        backward_date = start_date.clone(), offset_backward--;
    }

    // 向后搜索
    let offset_forward = 1, forward_date = new Date(date).clone();

    while (forward_date < finish) {
        const start_date = forward_date.clone();
        const finish_date = start_date.getNextDate(unit, 1);

        const range_start = start_date < start ? start.clone() : start_date;
        const range_finish = finish_date > finish ? finish.clone() : finish_date;

        result.push({
            "issue": issue + offset_forward, "range": {
                "start": range_start.toDateString(),
                "finish": range_finish.toDateString()
            }
        });

        forward_date = new Date(finish_date.getTime()), offset_forward++;
    }

    return result.sort((a, b) => a.issue - b.issue);
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

/**
 * 在内存中插入榜单数据
 * 
 * @param {("new"|"main")} type 榜单类别
 * @param {("daily"|"weekly"|"monthly")} source 目标文件来源
 * @param {string} filepath 文件绝对路径
 * @param {string} filename 文件名名称
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_normal_board_rank(type, source, filepath, filename, adder) {
    const content = read_xlsx(filepath), datetime = get_date_string(
        filename
    ), board_name = [ "vocaloid-" + source, "vocaloid-" + source + "-" + type ];

    console.log(`Type: ${type}, Source: ${source}, Counter: ${content.length}, Filename: ${filename}, Datetime: ${datetime}`);

    adder(content.length);

    append_rank_field(
        content, [
            "point", "view", "coin", "like", "favorite"
        ]
    ).forEach(data => {
        const id = {
            "song": gen_id("Song", memory.video.get(data.bvid) || data.name || data.title)
        };

        // console.log(source + ": " + datetime + " => " + memory.issue.get(board_name[0])[datetime]);

        memory.data.rank.set(
            gen_id("Record", board_name[1] + id.song + datetime), {
                "board": board_name[1], "issue": memory.issue.get(board_name[0])[datetime],
                "target": id.song, "rank": data.rank || data._rank.point + 1, "view_rank": data.view_rank || data._rank.view + 1,
                "like_rank": data.like_rank || data._rank.like + 1, "coin_rank": data.coin_rank || data._rank.coin + 1, "point": data.point,
                "favorite_rank": data.favorite_rank || data._rank.favorite + 1, "like_change": data.like,
                "coin_change": data.coin, "view_change": data.view, "favorite_change": data.favorite,
                "recorded_at": get_iso_time_text(), "platform": gen_id("Platform", data.bvid), "count": data.count ?? -1
            }
        );

        insert_song(data, adder);
    });
}

/**
 * 获取当前的 ISO 8601 毫秒级时间字符串
 * 
 * @param {Date} instance 需要转换的 Date 实例
 * @param {(text: string) => string} handler 结构处理器
 * @returns {string} 转换出来的结果
 */
function get_iso_time_text(instance = new Date(), handler = text => text) {
    return handler(instance.toISOString());
}

/**
 * 插入每日快照数据
 * 
 * @param {string} filepath 文件绝对路径
 * @param {string} filename 文件名名称
 * @param {(count: number) => number} adder 给 counter 自增的回调方法 
 */
function insert_snapshot_list(filepath, filename, adder) {
    const content = read_xlsx(filepath), datetime = get_date_string(
        filename
    );

    console.log(`Counter: ${content.length}, Filename: ${filename}, Datetime: ${datetime}`);

    adder(content.length);

    content.forEach(data => {
        if (!data.bvid) return;

        const id = {
            "song": gen_id("Song", memory.video.get(data.bvid) || data.name || data.title)
        };

        memory.data.snapshot.set(
            gen_id("Record", id.song + datetime), {
                "target": id.song, "view": data.view, "like": data.like,
                "coin": data.coin, "favorite": data.favorite, "recorded_at": get_iso_time_text(),
                "snapshot_at": datetime
            }
        );
    })
}

/**
 * 在数据库中创建标记关系
 * 
 * @param {object} data 决定标记关系的数据
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_mark(data, adder) {
    const identifier = gen_id("Record", data.type + data.target + data.value);

    if (!memory.data.mark.has(identifier)) memory.data.mark.set(
        identifier, Object.assign(data, {
            "set_at": get_iso_time_text()
        })
    ), adder();
    
    return {
        "_id": identifier, "target": memory.data.mark
    };
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
 * 在数据库中插入关联视频数据并构建关联关系（使用原始条目数据）
 * 
 * @param {object} data 原始条目数据
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_platform(data, adder) {
    const target = {
        "song": gen_id("Song", memory.video.get(data.bvid) || data.name),
        "video": gen_id("Platform", data.bvid)
    };

    const shortener = url => path.basename(new URL(url).pathname);

    adder();
    memory.data.platform.set(target.video, {
        "page": Math.floor(data.page ?? -1), // 这个 Math.floor 是真有必要
        "thumbnail": data.image_url ? "BB://I/" + shortener(data.image_url) : "No Image",
        "copyright": data.copyright ?? -1, "duration": data.duration ? human_duration_to_duration(
            data.duration.replace("分", ":").replace("秒", "")
        ) : -1, "recorded_at": get_iso_time_text(), "published_at": get_iso_time_text(
            new Date(data.pubdate), text => text.replace(/\.\d{3}/, "")
        ), "link": "BB://V/" + data.bvid, "title": data.title
    });

    insert_mark({
        "type": "platform",
        "value": target.video,
        "target": target.song
    }, adder);
}

/**
 * 在数据库中插入曲目数据（使用原始条目数据）
 * 
 * @param {object} data 原始条目数据
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_song(data, adder) {
    const song_name = memory.video.get(data.bvid) || data.name;
    const song_id = gen_id("Song", song_name), entries = Object.entries(data);

    insert_platform(data, adder);

    adder();
    memory.data.song.set(song_id, {
        "name": song_name, "type": data.type || "Unmarked",
        "add_at": get_iso_time_text(), "id": song_id
    });

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index], key = entry[0];
        
        if (!base.list.includes(key)) continue;

        entry[1].toString().split("、").map(name => {
            let field = base.map[key];

            name = name.trim() || "Unknown";

            const id = {
                "video": gen_id("Platform", data.bvid),
                "target": gen_id(cap(field), name)
            }, inserted_data = {
                "id": id.target, name,
                "add_at": get_iso_time_text()
            }, marked_data = {
                "type": field,
                "value": id.target,
                "target": song_id
            };

            if (field === "uploader") marked_data.target = id.video;
            if (field === "vocalist") inserted_data.color = -1;

            if (!memory.data[field].get(id.target)) memory.data[field].set(
                id.target, inserted_data
            ), adder();

            insert_mark(marked_data, adder);
        });
    }
}

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
        `INSERT OR ${table_name === "Vocalist_Table" ? "IGNORE" : "REPLACE" } INTO ${table} ( ${columns} ) VALUES ( ${placeholders} )`
    );

    instance.transaction((list) => {
        for (const target of list) {
            try {
                statement.run(
                    Object.values(target)
                );
            } catch (error) {
                console.log(Object.values(target));
            }
        }
    })(data_list);
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

const memory = {
    "issue": new Map(), "video": new Map(), "data": {
        "platform": new Map(), "vocalist": new Map(), "snapshot": new Map(),
        "synthesizer": new Map(), "uploader": new Map(), "song": new Map(),
        "producer": new Map(), "rank": new Map(), "mark": new Map()
    }
};

const { standard } = config.manifest;

if (standard) {
    const entries = Object.entries(standard);

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index], result = lister(entry[1], [
            new Date("2024-06-23"), new Date()
        ]);
        
        memory.issue.set(entry[0], Object.assign(
            Object.fromEntries(
                result.map(item => ([
                    item.range.finish, item.issue
                ]))
            ), Object.fromEntries(
                result.map(item => ([
                    item.issue, item.range.finish
                ]))
            )
        ));
    }
}

if (shell) {
    const { new: add, main, total, mode } = shell;

    let counter = 0;

    const adder = (count = 1) => counter += count;

    String.prototype.my_split = function () {
        return this.split(",").map(item => item.trim());
    }

    if (add) add.my_split().map(filepath => insert_normal_board_rank(
        "new", mode, path.resolve(
            root, filepath
        ), path.basename(filepath), adder
    ));

    if (main) main.my_split().map(filepath => insert_normal_board_rank(
        "main", mode, path.resolve(
            root, filepath
        ), path.basename(filepath), adder
    ));

    if (total) total.my_split().map(filepath => insert_snapshot_list(
        path.resolve(
            root, filepath
        ), path.basename(filepath), adder
    ));

    console.log(`目标文件已经全部分析完毕，共构建了 ${counter} 个有效映射关系`);
}

const memory_entries = Object.entries(memory.data);

let total = 0, task = {};

for (let index = 0; index < memory_entries.length; index++) {
    const entry = memory_entries[index], list = Array.from(entry[1]).map(item => Object.assign(
        item[1], { "id": item[0] }
    ));

    total += list.length, task[entry[0]] = list;
}

console.log("一共生成了 " + total + " 个条目，正在准备插入数据库");

instance.pragma("synchronous = OFF");
instance.pragma("journal_mode = WAL");

const operator = new DatabaseOperator(instance);

console.log("共计找到了 " + memory.data.song.size +  " 个曲目数据，即将尝试删除数据...");

operator.delete_item("Mark_Table", {
    "target": {
        "column": "target",
        "operator": "within",
        "value": [
            ...memory.data.song
        ].map(([key]) => key)
    }
});

console.log("数据删除成功，正在进行下一个步骤...");

Object.entries(task).forEach(entry => {
    if (entry[1].length < 1) return;

    const table_name = cap(entry[0]) + "_Table";

    console.log(table_name + " 表单正在准备开始插入");

    bulk_insert(
        table_name, entry[1], instance
    );

    console.log(table_name + " 表单插入完毕");
});

console.log("数据条目全部插入完毕");
console.log("正在尝试更新期刊信息原始数据定义文件（一般不需要长时间）");

const result = {
    "rank": instance.prepare(`
        SELECT
            board, issue, COUNT(*) AS count
        FROM Rank_Table
        GROUP BY board, issue
        ORDER BY board, issue
    `).all(),
    "snapshot": instance.prepare(`
        SELECT
            snapshot_at AS date, COUNT(*) AS count
        FROM Snapshot_Table
        GROUP BY date
    `).all()
};

const filepath = path.resolve(
    __dirname, "../service/define/default.json"
), content = JSON.parse(
    fs.readFileSync(filepath, "UTF-8")
);

Object.entries(classification(
    result.rank, item => item.board
)).forEach(([board, list]) => {
    content.metadata.board[board].catalog =
        list.map(({ issue, count }) => ({
            "date": memory.issue.get(board
                .replace(/-(?:new|main)/, "")
            )[issue], issue, count
        }));
});

content.metadata.snapshot = result.snapshot;

fs.writeFileSync(
    filepath, JSON.stringify(
        content, null, 4
    )
);

console.log("成功更新期刊信息原始数据定义文件");