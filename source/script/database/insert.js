import url from "url";
import xlsx from "xlsx";
import path from "path";
import SQLite3 from "better-sqlite3";
import * as updater from "./updater.js";
import fs from "fs";
import { command_parser } from "../depend/parse.js";
import {
    compute_hamc, get_type, quote_string,
    split_group, text_transformer as cap,
    append_rank_field
} from "../../depend/core.js";

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
    "path": config.global.database[field].path
};

const charset = "0123456789qazwsxedcrfvtgbyhnujmikolpQAZWSXEDCRFVTGBYHNUJMIKOLP-_";

const instance = new SQLite3(database.path, { 
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
function read_xlsx(filepath, target = 0, rename = true) {
    if (filepath.endsWith(".json")) return JSON.parse(
        fs.readFileSync(
            filepath, "UTF-8"
        )
    );

    const type = get_type(target);
    const workbook = xlsx.readFile(filepath);

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

    const result = xlsx.utils.sheet_to_json(
        workbook.Sheets[target(
            workbook.SheetNames
        )]
    );
    
    if (!rename) return result ?? read_xlsx(
        filepath, target, rename
    );

    const new_filepath = filepath.replace(/\.xlsx$/, ".json");

    fs.renameSync(filepath, new_filepath);

    fs.writeFileSync(new_filepath, JSON.stringify(result));

    return result ?? read_xlsx(
        new_filepath, target, rename
    );
}

/**
 * 通过一个歌手的名称取得代表色
 * 
 * @param {string} singer_nickname 要取得代表色的歌手名称
 * @returns {number} 歌手代表色（-1为获取不到）
 */
function get_singer_color_by_name(singer_nickname) {
    return memory.color.get(singer_nickname) || -1;
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
 * 在内存中插入普通榜单数据
 * 
 * @param {("new"|"main")} part 子榜单类别
 * @param {("daily"|"weekly"|"monthly")} source 目标文件来源
 * @param {string} filepath 文件绝对路径
 * @param {string} filename 目标文件名称
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_normal_board_rank(part = "main", source, filepath, filename, adder) {
    const date = get_date_string(filename);
    const board = "vocaloid-" + source;
    const dataset = read_xlsx(filepath);

    console.log(`Part: ${part}, Type: ${source}, Counter: ${dataset.length}, Filename: ${filename}, Datetime: ${date}`);

    adder(dataset.length);

    append_rank_field(dataset, [
        "point", "view", "coin", "like", "favorite"
    ]).forEach(data => {
        // console.log(data, get_song_name(data));

        const song_id = gen_id("Song", get_song_name(data));

        memory.data.rank.set(
            gen_id("Record", board + song_id + date + part), {
                "target": song_id, "point": data.point,
                "count": typeof data.count === "number" ? data.count : -1, board, part,
                "issue": memory.issue.get(board)[date],
                "platform": gen_id("Platform", data.bvid),
                "recorded_at": get_iso_time_text(),
                "rank": data.rank || data._rank.point + 1,
                "coin_change": data.coin, "view_change": data.view,
                "favorite_change": data.favorite, "like_change": data.like,
                "view_rank": data.view_rank || data._rank.view + 1,
                "like_rank": data.like_rank || data._rank.like + 1,
                "coin_rank": data.coin_rank || data._rank.coin + 1,
                "favorite_rank": data.favorite_rank || data._rank.favorite + 1
            }
        );

        if (part === "new") {
            if (URL.canParse(data.image_url)) {
                insert_song(data, adder);
            }
        }
    });
}

/**
 * 在内存中插入特殊榜单数据
 * 
 * @param {string} filepath 文件绝对路径
 * @param {string} datetime 目标刊物发刊时间
 * @param {number} issue 目标刊物的期号
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_special_board_rank(filepath, datetime, issue, adder) {
    const data = {};
    const board = "vocaloid-special";

    console.log(`Type: ${filepath}, Datetime: ${datetime}, Issue: ${issue}`);

    let sheets = [];

    const temp = read_xlsx(filepath, (list) => {
        sheets = list;

        for (let index = 1; index < sheets.length; index++) {
            const sheet = sheets[index];
            
            data[sheet] = read_xlsx(
                filepath, sheet, false
            );
        }

        return sheets[0];
    }, false);

    data[sheets[0]] = temp;

    for (let [ sheet, dataset ] of Object.entries(data)) {
        const part = sheet === "Sheet1" ? "main" : sheet;

        // console.log(dataset)

        adder(dataset.length);

        append_rank_field(dataset, [
            "point", "view", "coin", "like", "favorite"
        ]).forEach(data => {
            const song_id = gen_id("Song", get_song_name(data));

            memory.data.rank.set(
                gen_id("Record", board + song_id + datetime), {
                    "target": song_id, "point": data.point, part,
                    "count": typeof data.count === "number" ? data.count : -1, board, issue,
                    "recorded_at": get_iso_time_text(),
                    "platform": gen_id("Platform", data.bvid),
                    "rank": data.rank || data._rank.point + 1,
                    "coin_change": data.coin, "view_change": data.view,
                    "favorite_change": data.favorite, "like_change": data.like,
                    "view_rank": data.view_rank || data._rank.view + 1,
                    "like_rank": data.like_rank || data._rank.like + 1,
                    "coin_rank": data.coin_rank || data._rank.coin + 1,
                    "favorite_rank": data.favorite_rank || data._rank.favorite + 1
                }
            );

            insert_song(data, adder);
        });
    }
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
 * 获取指定目录的子集列表
 * 
 * @param {string} dirpath 目录路径
 * @param {object} options 配置信息
 * @param {boolean} options.include_directory 是否包含目录
 * @param {boolean} options.recursive 是否递归获取
 * @param {boolean} options.with_type 是否包含文件类型的知名符号（Symbol(type)）
 * @param {BufferEncoding} options.encoding 目标名称的编码
 * @returns {(fs.Dirent & { "filepath": string })[]} 获取到的目标的列表
 */
function get_dirpath_children(dirpath, options) {
    const {
        encoding = "UTF-8", recursive = true,
        include_directory = false,
        with_type: withFileTypes = true
    } = options;

    return fs.readdirSync(dirpath, {
        encoding, recursive, withFileTypes
    }).filter(dirent => {
        return dirent.isFile() ? true : include_directory;
    }).map(dirent => {
        dirent.filepath = path.join(dirent.path, dirent.name);

        return dirent;
    }).sort((a, b) => {
        return a.filepath.localeCompare(b.filepath);
    });
}

/**
 * 插入表单数据
 * 
 * @param {("new"|"main")} type 表单类型
 * @param {string} target_dirpath 表单数据目录地址
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_board(type, target_dirpath, adder) {
    const dirpath = path.resolve(
        root, target_dirpath
    );

    const dirents = get_dirpath_children(
        dirpath, { "include_directory": false }
    );

    console.log(`正在开始分析 ${target_dirpath} 目录下的曲目列表文件（共有 ${dirents.length} 个文件）`);

    for (let index = 0; index < dirents.length; index++) {
        const dirent = dirents[index];

        console.log(`目前正在处理 ./${path.relative(
            root, dirent.filepath
        ).split(path.sep).filter(item => item !== "..").join("/")} 文件`);
        
        insert_normal_board_rank(
            type, journal_mapping[
                path.basename(dirent.parentPath)
            ], dirent.filepath, dirent.name, adder
        );
    }
}

/**
 * 插入每日快照数据
 * 
 * @param {string} filepath 文件绝对路径
 * @param {string} filename 文件名名称
 * @param {(count: number) => number} adder 给 counter 自增的回调方法 
 */
function insert_snapshot_list(filepath, filename, adder) {
    const content = read_xlsx(filepath);
    const datetime = get_date_string(filename);

    console.log(`Counter: ${content.length}, Filename: ${filename}, Datetime: ${datetime}`);

    adder(content.length);

    content.forEach(data => {
        if (!data.bvid) return;

        const platform_id = gen_id("Platform", data.bvid);

        memory.data.snapshot.set(
            gen_id("Record", platform_id + datetime), {
                "target": platform_id, "snapshot_at": datetime,
                "view": data.view, "like": data.like,
                "coin": data.coin, "favorite": data.favorite,
                "recorded_at": get_iso_time_text()
            }
        );
    })
}

/**
 * 插入每日快照数据
 * 
 * @param {string} target_dirpath 目标表单数据目录地址
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_snapshot(target_dirpath, adder) {
    const dirpath = path.resolve(
        root, target_dirpath
    );

    const dirents = get_dirpath_children(
        dirpath, { "include_directory": false }
    );

    console.log(`正在开始分析 ${target_dirpath} 目录下的曲目列表文件（共有 ${dirents.length} 个文件）`);

    for (let index = 0; index < dirents.length; index++) {
        const dirent = dirents[index];

        console.log(`目前正在处理 ./${path.relative(
            root, dirent.filepath
        ).split(path.sep).filter(item => item !== "..").join("/")} 文件`);
        
        insert_snapshot_list(
            dirent.filepath, dirent.name, adder
        );
    }
}

/**
 * 在数据库中创建标记关系
 * 
 * @param {object} data 决定标记关系的数据
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_mark(data, adder) {
    const { type, value, target } = data;

    data = Object.assign(data, {
        "set_at": get_iso_time_text()
    });

    const id = gen_id("Mark", type + value + target);

    if (!memory.data.mark.has(id)) {
        adder();

        memory.data.mark.set(
            id, data
        );
    }
    
    return {
        "id": id, "data": data
    };
}

/**
 * 将易于人类理解的时长（45, 2:12, 13:14:14）转换成易于计算机理解的时长
 * 
 * @param {string} human_duration 需要转换的人类易于理解的时长
 * @returns {number} 计算机容易理解的时长
 */
function human_duration_to_duration(human_duration) {
    let result = 0;
    const part = human_duration.split(/:0{0,1}/);

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
        "song": gen_id("Song", get_song_name(data)),
        "video": gen_id("Platform", data.bvid)
    };

    const shortener = url => {
        if (URL.canParse(url)) {
            return "BB://I/" + path.basename(new URL(url).pathname);
        }

        return null;
    };

    adder();

    memory.data.platform.set(target.video, {
        "title": data.title, "page": Math.floor(data.page ?? -1), // 这个 Math.floor 是真有必要
        "thumbnail": data.image_url ? shortener(data.image_url) : "No Image",
        "copyright": data.copyright ?? -1, "link": "BB://V/" + data.bvid,
        "duration": data.duration ? human_duration_to_duration(
            data.duration.replace("分", ":").replace("秒", "")
        ) : -1, "recorded_at": get_iso_time_text(), "published_at": data.pubdate ? get_iso_time_text(
            new Date(data.pubdate), text => text.replace(/\.\d{3}/, "")
        ) : get_iso_time_text(new Date(0))
    });

    insert_mark({
        "type": "platform",
        "value": target.video,
        "target": target.song
    }, adder);
}

const collate = {
    "index": JSON.parse(
        fs.readFileSync(path.resolve(
            __dirname, "./define/collate.json"
        ), "UTF-8")
    )
};

collate.bvids = Object.keys(collate.index);
collate.names = Object.values(collate.index);

/**
 * 获取曲目名称
 * 
 * @param {object} data 曲目信息记录项
 * @returns {string} 曲目名称
 */
function get_song_name(data) {
    const { bvid, name } = data;

    if (
        !collate.bvids.includes(bvid) &&
        collate.names.includes(name)
    ) {
        collate.index[bvid] = collate[collate.bvids[
            collate.names.indexOf(name)
        ]] ?? name;
    } else if (!collate.index[bvid]) {
        collate.index[bvid] = name;
    }

    return collate.index[bvid];
}

/**
 * 在数据库中插入曲目数据（使用原始条目数据）
 * 
 * @param {object} data 原始条目数据
 * @param {(count: number) => number} adder 给 counter 自增的回调方法
 */
function insert_song(data, adder) {
    const entries = Object.entries(data);
    const song_id = gen_id("Song", get_song_name(data));

    adder();

    memory.data.song.set(song_id, {
        "name": get_song_name(data),
        "type": data.type || "Unmarked",
        "add_at": get_iso_time_text()
    });

    insert_platform(data, adder);

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        
        if (!base.list.includes(entry[0])) continue;

        entry[1].toString().split("、").forEach(name => {
            const field = base.map[entry[0]];

            name = name.trim();

            if (!name) return;

            const id = {
                "video": gen_id("Platform", data.bvid),
                "target": gen_id(cap(field), name)
            }, _data = {
                "mark": {
                    "type": field,
                    "value": id.target,
                    "target": song_id
                },
                "insert": {
                    "id": id.target, "name": name,
                    "add_at": get_iso_time_text()
                }
            };

            if (field === "uploader") _data.mark.target = id.video;
            if (field === "vocalist") _data.insert.color = get_singer_color_by_name(name);

            if (!memory.data[field].get(id.target)) {
                adder();

                memory.data[field].set(
                    id.target, _data.insert
                );
            }

            insert_mark(_data.mark, adder);
        });
    }
}

const memory = {
    "color": new Map(), "issue": new Map(), "video": new Map(), "data": {
        "platform": new Map(), "vocalist": new Map(), "snapshot": new Map(),
        "synthesizer": new Map(), "uploader": new Map(), "song": new Map(),
        "producer": new Map(), "rank": new Map(), "mark": new Map()
    }
};

const journal_mapping = {
    "日刊": "daily",
    "周刊": "weekly",
    "月刊": "monthly"
};

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

const { data, history, standard, special } = config.manifest;

if (data) {
    const { singer_color: singer_color_filepath, song_summa: song_summa_filepath } = data;

    let counter = 0;

    const adder = (amount = 1) => counter += amount;

    console.log(`正在开始分析数据定义文件文件`);

    if (singer_color_filepath) {
        const filepath = path.resolve(
            root, singer_color_filepath
        ), content = JSON.parse(
            fs.readFileSync(
                filepath, "UTF-8"
            )
        );
    
        console.log(`正在开始分析 ${singer_color_filepath} 歌手代表色定义文件`);
    
        for (let index = 0, color_number = -1; index < content.length; index++) {
            const target = content[index];
            
            for (let sequence = 0; sequence < target.length; sequence++) {
                const data = target[sequence];
                
                if (sequence === 0) {
                    color_number = Number("0x" + data);

                    continue;
                }

                adder();
                
                memory.color.set(
                    data, color_number
                );
            }
        }
    }

    if (song_summa_filepath) {
        const filepath = path.resolve(
            root, song_summa_filepath
        ), content = read_xlsx(filepath);
    
        console.log(`正在开始分析 ${song_summa_filepath} 历史收录曲目数据定义文件`);
    
        for (let index = 0; index < content.length; index++) {
            const song_data = content[index];

            adder();

            memory.video.set(
                song_data.bvid, song_data.name
            );

            insert_song(song_data, adder);
        }
    }

    console.log(`目标文件已经全部分析完毕，共构建了 ${counter} 个有效映射关系`);
}

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

if (special) {
    console.log("正在开始分析特刊文件");

    let counter = 0;

    const adder = (amount = 1) => counter += amount;

    for (let index = 0; index < special.length; index++) {
        const config = special[index];
        
        insert_special_board_rank(
            config.path, config.date,
            index + 1, adder
        );
    }

    console.log(`目标文件已经全部分析完毕，共构建了 ${counter} 个有效映射关系`);
}

if (history) {
    console.log("正在开始历史期刊文件");

    let counter = 0;

    const adder = (count = 1) => counter += count;

    const { add, total, change } = history;

    if (add) insert_board("new", add, adder);

    if (total) insert_snapshot(total, adder);

    if (change) insert_board("main", change, adder);

    console.log(`目标文件已经全部分析完毕，共构建了 ${counter} 个有效映射关系`);
}

const memory_entries = Object.entries(memory.data);

let total = 0, task = {};

for (let index = 0; index < memory_entries.length; index++) {
    const entry = memory_entries[index], list = Array.from(entry[1]).map(item =>
        Object.assign(
            item[1], { "id": item[0] }
        )
    );

    total += list.length;
    task[entry[0]] = list;
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

    instance.transaction((items, columns) => {
        for (const current of items) {
            const values = columns.map(item =>
                current[item] ?? null
            );

            try {
                statement.run(values);
            } catch (error) {
                console.log(values, error);
            }
        }
    })(data_list, Object.keys(data_list[0]));
}

instance.pragma("synchronous = OFF");
instance.pragma("journal_mode = WAL");

Object.entries(task).forEach(entry => {
    if (entry[1].length < 1) return;

    const table_name = entry[0].split("_").map(
        item => cap(item)
    ).join("_") + "_Table";

    console.log(table_name + " 表单正在准备开始插入");

    bulk_insert(
        table_name, entry[1], instance
    );

    console.log(table_name + " 表单插入完毕");
});

console.log("数据条目全部插入完毕");

const filepath = {
    "define": path.resolve(
        __dirname, "../service/define/default.json"
    ),
    "collate": path.resolve(
        __dirname, "./define/collate.json"
    )
};

import { close, get_song_info_by_id } from "../service/core/interface.js";

updater.define(instance, filepath.define, {
    "get_song_info": get_song_info_by_id
}, memory.issue, special);

updater.collate(collate.index, filepath.collate);

close();
instance.close();
process.exit(0);