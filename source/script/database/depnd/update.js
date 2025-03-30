import fs from "fs";
import { classification, quote_string, split_group } from "../../../depend/core.js";

/**
 * 序列化 JSON 对象为字符串
 * 
 * @param {object} data 需要序列化的 JSON 对象
 * @returns {string} 序列化结果
 */
function stringify(data) {
    return JSON.stringify(data, null, 4);
}

/**
 * 更新勘误文件的内容
 * 
 * @param {object} collate 勘误文件中的内容
 * @param {string} filepath 勘误文件所处的绝对路径
 */
export function collate(collate, filepath) {
    const content = stringify(collate);

    fs.writeFileSync(
        filepath, content, "UTF-8"
    );

    console.log("成功更新勘误数据文件");
}

/**
 * 移除指定对象的属性（直接修改原始对象）
 * 
 * @param {object} object 需要移除属性的对象
 * @param {string} path 目标属性所处的位置（如a/b/c）
 * @returns {object} 移除完成后的对象
 */
function remove(object, path) {
    const parts = path.split("/");

    if (parts.length === 1) {
        delete object[path];
    } else {
        const key = parts.shift();

        remove(object[key], parts.join("/"));
    }

    return object;
}

/**
 * 移除曲目数据中不需要的部分
 * 
 * @param {object} data 需要移除不需要的部分的曲目数据
 * @returns {object} 移除了不需要的部分的曲目数据
 */
function reduction(data) {
    const result = {};

    for (const [ key, value ] of Object.entries(data)) {
        if (key === "metadata") {
            result.metadata = value;

            const { target } = value;

            for (const [ key, value ] of Object.entries(target)) {
                target[key] = value.map(
                    ({ id }) => id
                );
            }
        } else if (key === "platform") {
            const { id, uploader, ...rest } = value;

            result.platform = Object.assign(
                { id }, rest, {
                    "uploader": uploader.map(
                        ({ id }) => id
                    )
                }
            );
        } else {
            result[key] = data[key];
        }
    }

    return result;
}

/**
 * 更新数据定义
 * 
 * @typedef {import("better-sqlite3").Database} DatabaseInstance
 * 
 * @param {DatabaseInstance} instance 需要更新定义数据的数据库实例
 * @param {string} filepath 更新的定义文件所处的绝对路径
 * @param {object} depend 更新所使用的依赖
 * @param {object} memory 更新数据的时候维护的 memory 变量
 * @param {object} special 更新数据的时候维护的 special 变量
 */
export function define(instance, filepath, depend, memory, special) {
    const content = Object.assign({
        "metadata": {
            "board": {},
            "snapshot": []
        },
        "catalog": {}
    }, JSON.parse(fs.readFileSync(
        filepath, "UTF-8"
    )));

    const { get_song_info } = depend;

    console.log("正在尝试更新期刊信息原始数据定义文件");

    const result = {
        "rank": instance.prepare(`
            SELECT
                board, issue, part, COUNT(*) AS count
            FROM Rank_Table
            GROUP BY board, issue, part
            ORDER BY board, issue, part
        `).all(),
        "snapshot": instance.prepare(`
            SELECT
                snapshot_at AS date, COUNT(*) AS count
            FROM Snapshot_Table
            GROUP BY date
            ORDER BY date ASC
        `).all()
    };

    const entries = Object.entries(classification(
        result.rank, item => item.board
    ));
    
    for (const [ board, list ] of entries) {
        const entries = Object.entries(classification(
            list, (item) => item.issue
        ));

        for (let index = 0; index < entries.length; index++) {
            const [ issue, items ] = entries[index];
            
            const total = items.reduce(
                (total, { count }) => total + count, 0
            );
    
            const parts = {}, metadata = {};
    
            items.map(({ part, count }) => {
                parts[part] = count;
            });
    
            metadata.issue = Number(issue);
    
            if (board === "vocaloid-special") {
                const data = special[issue - 1];
    
                metadata.date = data.date;
                metadata.name = data.name;
            } else {
                const data = memory.issue.get(board)[issue];
    
                metadata.date = data.date;
                metadata.name = content.metadata.board[board].name + " #" + issue;
            }
    
            entries[index] = Object.assign(metadata, {
                "index": index,
                "part": parts, total
            });
        }
    
        content.metadata.board[board].catalog = entries;
    }
    
    content.metadata.snapshot = result.snapshot.map(
        (item, index) => Object.assign(
            { index }, item
        )
    );

    const catalog = {
        "song": [],
        "producer": [],
        "vocalist": [],
        "uploader": [],
        "synthesizer": []
    };

    const ids = instance.prepare("SELECT id FROM Song_Table").all();

    const groups = split_group(ids, 4096);

    const handler = (type, data) => {
        let result;

        if (type === "song") {
            result = reduction(data);
        } else {
            result = remove(data, "add_at");
        }

        return result;
    }

    groups.forEach(group => {
        const ids = group.map(({ id }) => id);
        const dataset = get_song_info(ids);

        console.log(ids);
        
        const info = Object.fromEntries(Object.entries(classification(
            instance.prepare(
                `WITH Ranked AS (
                    SELECT 
                        id, target, board, count, platform,
                        ROW_NUMBER() OVER (PARTITION BY board, target ORDER BY count DESC) AS rn
                    FROM Rank_Table
                    WHERE 
                        board IN ( 'vocaloid-weekly', 'vocaloid-daily' ) AND
                        target IN ( ${ids.map(
                            item => quote_string(item, "single")
                        ).join(", ")} )
                )
                SELECT id, target, board, count, platform
                FROM Ranked
                WHERE rn = 1;`
            ).all(), item => item.target
        )).map(([ id, info ]) => {
            const map = Object.fromEntries(info.map(
                item => [ item.board, item.count ]
            ));

            return [ id, {
                "count": {
                    "daily": map["vocaloid-daily"] || 0,
                    "weekly": map["vocaloid-weekly"] || 0
                },
                "platform": info[0].platform
            } ];
        }));

        dataset.forEach(data => {
            const target = info[data.id];

            data.platform = target ? data.platform.find(
                ({ id }) => id === target.platform
            ) : data.platform[0];
        });
        
        const stat = Object.fromEntries(instance.prepare(
            `SELECT
                target, view, coin, like, favorite
            FROM (
                SELECT *, ROW_NUMBER() OVER (
                    PARTITION BY target 
                    ORDER BY snapshot_at DESC
                ) AS rn
                FROM Snapshot_Table
                WHERE target IN ( ${dataset.map(
                    item => quote_string(item.platform.id, "single")
                ).join(", ")} )
            ) ranked
            WHERE rn = 1`
        ).all().map(
            item => [ item.target, {
                "view": item.view,
                "coin": item.coin,
                "like": item.like,
                "favorite": item.favorite
            } ]
        ));

        dataset.forEach(data => {
            data.platform = Object.assign(data.platform, {
                "stat": stat[data.platform.id]
            });
        });

        dataset.forEach(
            data => catalog.song.push(
                Object.assign(handler("song", data), {
                    "count": (info[data.metadata.id] || { "count": {} }).count
                })
            )
        );
    });

    function _dump(table) {
        const iterator = instance.prepare(`SELECT * FROM ${table}_Table`).iterate();

        for (const item of iterator) {
            catalog[table].push(
                handler(table, item)
            );
        }
    }

    for (const table of Object.keys(catalog)) {
        if (table === "song") {
            continue;
        }

        _dump(table);
    }

    content.catalog = catalog;

    fs.writeFileSync(
        filepath, stringify(content), "UTF-8"
    );

    console.log("成功更新期刊信息原始数据定义文件");
}