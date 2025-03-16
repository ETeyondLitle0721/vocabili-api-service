import SQLite3 from "better-sqlite3"; import template from "../utilities/template.js";
import {
    repair_character as repair, get_type,
    to_string, quote_string, unique_array,
    object_merge
} from "../core.js";

/**
 * @typedef {("<"|">"|"<="|">="|"<>"|"!="|"==")} GeneralOperator
 * @typedef {(number|string|boolean)} NormalType
 * @typedef {Object<string, NormalType>} GeneralObject
 * 
 * @typedef GeneratorResponse
 * @property {("execute"|"request")} action 推荐的执行方法
 * @property {string} sentence 构建出来的 SQL 语句
 * @property {GeneralObject} parameter 用于防注入的参数化查询映射表
 * 
 * @typedef ItemInsertOptions
 * @property {("direct-insert"|"if-not-exists"|"if-exists-replace")} flag 创建插入语句的标识
 * @property {string} table 要插入的表单的名称
 * @property {(GeneralObject|GeneralObject[])} target 要插入的项目列表
 * 
 * @typedef ItemSelectWhereSingleOptions
 * @property {"not"} mark 标记
 * @property {string} column 比较的列名
 * @property {(GeneralObject|NormalType[])} value 取值
 * @property {("binary"|"nocase")} collate 数值校对模式 
 * @property {("like"|"equal"|"range"|"within"|GeneralOperator)} operator 运算符
 * 
 * @typedef ItemSelectWhereGroupOptions
 * @property {("or"|"and")} joiner 多个表达式之间的连接符
 * @property {(ItemSelectWhereSingleOptions|ItemSelectWhereSingleOptions[])} children 表达式列表
 * 
 * @typedef {(ItemSelectWhereSingleOptions|ItemSelectWhereSingleOptions[]|ItemSelectWhereGroupOptions)} ItemSelectWhereOptions
 * 
 * @typedef ItemSelectOptions
 * @property {("includes-rowid")} flag 附带的标志
 * @property {object} source 定义查询来源的配置项目
 * @property {string[]} source.select 选中的列的名称
 * @property {string} source.table 需要查询的表
 * @property {ItemSelectWhereOptions} where 选中项目所需达成的条件
 * @property {object} control 控制配置项
 * @property {object} control.group 分组控制项
 * @property {(string|string[])} control.group.column 依据字段
 * @property {object} control.order 排序控制项
 * @property {(string|string[])} control.order.column 依据字段
 * @property {("ascending"|"descending")} control.order.method 排序方法
 * @property {object} control.result 结果控制项
 * @property {number} control.result.limit 单页最大返回项目数
 * @property {number} control.result.offset 页索引偏移量
 * 
 * @typedef ItemCountOptions
 * @property {object} source 定义计数来源的配置项目
 * @property {string} source.table 需要计数的表
 * @property {ItemSelectWhereOptions} where 选中项目所需达成的条件
 * 
 * @callback ParameterCallback
 * @param {string} real 真实值
 * @param {string} nickname 这个值的化名
 * @param {string} name 当前列的列名
 * 
 * @typedef TableCreateColumnOptions
 * @property {string} name 列的名称
 * @property {(("primary-key"|"auto-increment")|("primary-key"|"auto-increment")[])} mark 列的标注
 * @property {object} value 值的配置
 * @property {("text"|"decimal"|"integer"|"boolean")} value.type 值的类型
 * @property {NormalType} value.default 默认值
 * @property {(("unique"|"not-null")|("unique"|"not-null")[])} value.restrict 值的制约
 * 
 * @typedef TableCreateOptions
 * @property {string} name 表单的名称
 * @property {("if-not-exists"|"direct-create")} flag 构建 SQL 语句的时候的标记
 * @property {TableCreateColumnOptions[]} column 表单的列的列表
 * 
 * @typedef ItemUpdateOptions
 * @property {string} table 要更新的项目所处的表单的名称
 * @property {ItemSelectWhereOptions} target 选中目标的条件
 * 
 * @typedef {(TableCreateOptions|ItemInsertOptions|ItemSelectOptions|ItemUpdateOptions)} GeneralHandlerOptions
 * 
 * @callback ResponseHandler
 * @param {GeneralHandlerOptions} options 原始配置信息
 * @param {GeneratorResponse} response 语句构建器响应结果
 * @returns {GeneratorResponse} 经过处理的语句
 * 
 * @typedef TableDropOptions
 * @param {("if-exists"|"direct-drop")} flag 构建 SQL 语句的时候的标记
 * @param {string} table 需要删除的表单的名称
 * 
 * @typedef IndexDropOptions
 * @property {string} name 出要撤销索引的名称
 * @property {(("if-exists")[]|"if-exists")} flag 撤销的时候传递的标记信息
 * 
 * @typedef IndexCreateOptions
 * @property {string} name 需要创建的索引名称
 * @property {string} table 需要创建索引的表单
 * @property {(("unique"|"if-not-exists")[]|"unique"|"if-not-exists")} flag 创建的时候传递的标记信息
 * @property {string[]} 需要创建索引的列名称
 * 
 * @callback ParameterSetter
 * @param {any} real 真实值
 * @param {string} nickname 数值别名
 * @returns {any} 设定参数值的真实值
 * 
 * @callback SequenceGetter
 * @returns {number} 获取到的序列值
 * 
 * @typedef TableAlterOptions
 * @property {("column"|"table")} target 需要操作的目标
 * @property {("add"|"rename")} operate 需要进行的操作
 * @property {(TATRenameDefine|TACRenameDefine|TACAddDefine)} define 操作定义项
 * 
 * @typedef TATRenameDefine
 * @property {string} name 重命名之后的名称
 * @property {string} table 需要重命名的表单的名称
 * 
 * @typedef TACRenameDefine
 * @property {string} table 目标列所处的表单的名称
 * @property {object} column 目标的列定义
 * @property {string} column.old 目标列的原始名称
 * @property {string} column.new 目标列的新名称
 * 
 * @typedef TACAddDefine
 * @property {string} table 需要添加列的表单的名称
 * @property {string} column 添加的目标列的名称
 * @property {TableCreateColumnOptions} define 列定义
 * 
 * @typedef SavePointOptions
 * @property {string} name 目标保存点的名称
 * @property {("create"|"release"|"rollback")} operate 需要执行的操作
 * 
 * @typedef TransactionOptions
 * @property {("begin"|"commit"|"rollback")} operate 需要执行的操作
 */

/**
 * 调用就可以返回一个 SequenceGetter 的方法
 * 
 * @returns {SequenceGetter} 返回的 SequenceGetter 方法
 */
const _getter = () => {
    let sequence = 0;

    return () => {
        return ++sequence;
    };
};

/**
 * 调用就可以返回一个 ParameterSetter 的方法
 * 
 * @returns {ParameterSetter} 返回的 ParameterSetter 方法
 */
const _setter = (parameter = {}) => {
    return (real, nickname) => {
        return parameter[nickname] = real;
    };
};

const quote = (text, type = "double") => quote_string(text, type);
const indent = 4;

/**
 * 生成 Nickname 并添加到映射对象
 * 
 * @param {NormalType} value 真实值
 * @param {number} sequence 参数值序号
 * @param {ParameterCallback} setter 添加映射对象的回调方法
 * @returns {string} 生成的 Nickname 字符串
 */
function placeholder(value, sequence, setter = _setter()) {
    const nickname = `Value_${repair(sequence, 6, "0")}`;

    setter(value, nickname);

    return ":" + nickname;
}

/**
 * 解析 Column 定义语句配置信息为 SQL 语句
 * 
 * @param {TableCreateColumnOptions} options 需要解析的对象
 * @returns {string} 解析出来的 SQL 字符串
 */
function parse_column(options) {
    let { mark = [], value: {
        default: value, restrict = []
    } } = options;

    const constraint = [];

    if (Array.isArray(mark)) mark = [ mark ];
    if (Array.isArray(restrict)) restrict = [ restrict ];

    if (value !== undefined) {
        const type = get_type(value);

        if (type.first === "boolean") {
            value = value ? 1 : 0;
        }

        if (type.first === "string") {
            value = quote(value);
        }

        constraint.push("DEFAULT " + to_string(value));
    };

    if (mark.includes("primary-key")) constraint.push("PRIMARY KEY");
    if (mark.includes("auto-increment")) constraint.push("AUTOINCREMENT");

    if (restrict.includes("unique")) constraint.push("UNIQUE");
    if (restrict.includes("not-null")) constraint.push("NOT NULL");

    return template.replace(
        "{{column}} {{type}} {{constraint}}", {
            "type": options.value.type.toUpperCase(),
            "column": quote(options.name),
            "constraint": constraint.join(" ")
        }
    ).trimEnd();
}

/**
 * 解析 Where 语句配置信息为 SQL 语句
 * 
 * @param {ItemSelectWhereOptions} options 需要解析的 Where 语句配置信息
 * @param {ParameterSetter} setter 添加参数值映射的回调函数
 * @param {SequenceGetter} getter 可以获取当前的 sequence 值的回调函数
 * @returns {string} 解析出来的 SQL 语句
 */
function parse_where(options = {}, setter = _setter(), getter = _getter()) {
    if (Array.isArray(options)) {
        return parse_where({
            "joiner": "and",
            "children": options
        }, setter, getter);
    }

    if (Array.isArray(options.children)) {
        let { joiner = "and", children = [] } = options, part = [];

        for (let index = 0; index < children.length; index++) {
            part.push(parse_where(
                children[index], setter, getter
            ));
        }

        return `(${part.join(` ${joiner.toUpperCase()} `)})`;
    }

    let result = "", value = options.value;
    const { mark, column, collate, operator } = options;

    const generate = (value) => {
        const result = placeholder(
            value, getter(), setter
        );

        return collate ? [
            result, "COLLATE " + collate.toUpperCase()
        ].join(" ") : result;
    };

    if (operator === "equal") {
        const part = [];

        if (!Array.isArray(value)) {
            value = [ value ];
        }

        for (let index = 0; index < value.length; index++) {
            part.push(`${quote(column)} = ${generate(value[index])}`);
        }

        result = part.join(" OR ");
    }

    if (operator === "like") {
        result = `${quote(column)} LIKE ${generate(value)}`;
    }

    if (operator === "range") {
        const { minimum, maximum } = value;

        result = `${quote(column)} BETWEEN ${generate(minimum)} AND ${generate(maximum)}`;
    }

    if (operator === "within") {
        if (!Array.isArray(value)) {
            value = [ value ];
        }

        result = `${quote(column)} IN ( ${value.map(item => 
            generate(item)
        ).join(", ")} )`;
    }

    if ([ ">", ">=", "<", "<=", "<>", "==", "!=" ].includes(operator)) {
        result = `${quote(column)} ${operator} ${generate(value)}`;
    }

    if (mark === "not") {
        return `NOT (${result})`;
    }

    return result;
}

/**
 * 解析映射对象为 SQL 元组
 * 
 * @param {[string, NormalType][]} tuple 需要解析的元组信息
 * @param {ParameterSetter} setter 添加参数值映射的回调函数
 * @param {SequenceGetter} getter 可以获取当前的 sequence 值的回调函数
 * @returns {string} 解析出来的 SQL 元组
 */
function parse_tuple(tuple = {}, setter = _setter(), getter = _getter()) {
    return "( " + tuple.map(item => placeholder(
        item[1], getter(), setter
    )).join(", ") + " )";
}

/**
 * 批量插入数据
 * 
 * @param {string} table_name 需要插入数据的表单的名称
 * @param {GeneralObject[]} data_list 需要插入的数据
 * @param {SQLite3.Database} instance 数据库实例化对象
 * @returns {SQLite3.RunResult[]} 执行结果
 */
export function batch_insert(table_name, data_list, instance) {
    if (data_list.length === 0) return [];

    const table = quote(table_name);
    const sample = Object.keys(data_list[0]);
    const columns = sample.map(_ => quote(_)).join(", ");
    const placeholders = sample.fill("?").join(", ");

    const statement = instance.prepare(
        `INSERT OR REPLACE INTO ${table} ( ${columns} ) VALUES ( ${placeholders} )`
    ), response = [];

    const restore = (instance, original) => {
        instance.pragma("synchronous = " + original.synchronous);
        instance.pragma("journal_mode = " + original.journal_mode);
    };

    const original = {
        "synchronous": instance.pragma("synchronous", {
            simple: true
        }),
        "journal_mode": instance.pragma("journal_mode", {
            simple: true
        })
    };

    instance.pragma("synchronous = OFF");
    instance.pragma("journal_mode = WAL");

    instance.exec("BEGIN TRANSACTION");

    for (const target of data_list) {
        try {
            response.push(
                statement.run(
                    Object.values(target)
                )
            );
        } catch (error) {
            console.log(statement.raw, target);

            instance.exec("ROLLBACK");

            restore(instance, original);

            throw error;
        }
    }

    instance.exec("COMMIT");

    instance.pragma("wal_checkpoint(FULL)");

    restore(instance, original);

    return response;
}

/**
 * 构建用于向数据库中的表单之中插入项目的 SQL 语句
 * 
 * @param {ItemInsertOptions} options 构建插入语句时的构建参数
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _item_insert(options = {}) {
    let target = options.target || [];
    const { flag, table } = options;
    const value = [], column = [], replacer = {
        "statement": "INSERT"
    }, parameter = {};

    const getter = _getter();
    const setter = _setter(parameter);

    if (!Array.isArray(target)) {
        target = [ target ];
    }

    replacer.table = quote(table);

    if (flag) replacer.statement = {
        "direct-insert": "INSERT",
        "if-not-exists": "INSERT OR IGNORE",
        "if-exists-replace": "INSERT OR REPLACE"
    }[flag] || replacer.statement;

    for (let index = 0; index < target.length; index++) {
        const entities = Object.entries(target[index]);

        if (target[index]) value.push(parse_tuple(
            entities, setter, getter
        ));

        entities.forEach(([ name ]) => column.push(name));
    }

    const sentence = template.replace(
        "{{statement}} INTO {{table}} ( {{column}} ) VALUES {{value}}",
        Object.assign(replacer, {
            "value": value.join(", "),
            "column": unique_array(column).map(name => {
                return quote(name);
            }).join(", ")
        })
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": parameter
    };
}

const method_mapping = {
    "ascending": "asc",
    "descending": "desc"
};

/**
 * 构建可以在数据库中的表单之中索引符合目标要求的项目的 SQL 语句
 * 
 * @param {ItemSelectOptions} options 构建检索语句时的构建参数
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _item_select(options = {}) {
    const part = [], parameter = {};
    const { flag = "", where = {}, source = {}, control = {} } = options;

    const getter = _getter();
    const setter = _setter(parameter);

    let select = "SELECT";

    if (flag === "includes-rowid") select += " rowid,";

    select += " ";

    if (source.select === "all") {
        select += "*";
    } else {
        select += source.select.map(item => {
            return quote(item);
        }).join(", ");
    }

    part.push(select);
    part.push("FROM " + quote(source.table));

    if (Object.keys(where).length > 0) {
        part.push("WHERE " + parse_where(
            where, setter, getter
        ));
    }

    if (control.order) {
        let column = control.order.column;
        const { method } = control.order;

        if (!Array.isArray(column)) {
            column = [ column ];
        }

        part.push([
            "ORDER BY", column.map(name => quote(name)).join(", "),
            method_mapping[method]
        ].join(" "));
    }

    if (control.group) {
        let column = control.group.column;
        const { method } = control.group;

        if (!Array.isArray(column)) {
            column = [ column ];
        }

        part.push([
            "GROUP BY", column.map(name => quote(name)).join(", "),
            method_mapping[method]
        ].join(" "));
    }

    if (control.result) {
        const { limit, offset } = control.result;

        if (limit) {
            part.push("LIMIT " + placeholder(
                limit, getter(), setter
            ));

            if (!offset) {
                part.push("OFFSET 0");
            }
        }

        if (offset) {
            part.push("OFFSET " + placeholder(
                offset, getter(), setter
            ));
        }
    }

    return {
        "action": "execute",
        "sentence": part.join(" "),
        "parameter": parameter
    };
}

/**
 * 构建可以在数据库中的表单之中索引符合目标要求的项目的 SQL 语句
 * 
 * @param {ItemCountOptions} options 构建检索语句时的构建参数
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _item_count(options = {}) {
    const part = [], parameter = {};
    const { where = {}, source } = options;

    const getter = _getter();
    const setter = _setter(parameter);

    part.push("SELECT COUNT(*)");
    part.push("FROM " + quote(source.table));

    if (Object.keys(where).length > 0) {
        part.push("WHERE " + parse_where(
            where, setter, getter
        ))
    };

    return {
        "action": "execute",
        "sentence": part.join(" "),
        "parameter": parameter
    };
}

/**
 * 构建可以删除数据库中的表单的记录的 SQL 语句
 * 
 * @param {object} options 选中项目的 Where 语句
 * @param {string} options.table 要删除的项目所处的表单的名称
 * @param {ItemSelectWhereOptions} options.target 选中目标的条件
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _item_delete(options = {}) {
    const parameter = {}, part = [];
    const { table, target: where = {} } = options;

    const getter = _getter();
    const setter = _setter(parameter);

    part.push("DELETE FROM " + quote(table));

    if (Object.keys(where).length > 0) {
        part.push("WHERE " + parse_where(
            where, setter, getter
        ));
    }

    return {
        "action": "request",
        "sentence": part.join(" "),
        "parameter": parameter
    };
}

/**
 * 构建可以更新数据库中的表单的记录的 SQL 语句
 * 
 * @param {ItemUpdateOptions} options 构建 SQL 语句的配置
 * @param {GeneralObject} options.data 更新为的数据
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _item_update(options = {}) {
    const part = [], parameter = {};
    const { table, target = {}, data = {} } = options;

    const getter = _getter();
    const setter = _setter(parameter);
    const entries = Object.entries(data);

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        
        part.push(`${quote(entry[0])} = ${placeholder(
            entry[1], getter(), setter
        )}`);
    }

    const sentence = template.replace(
        "UPDATE {{table}} SET {{value}} WHERE {{where}}", {
            "table": quote(table),
            "value": part.join(", "),
            "where": parse_where(
                target, setter
            )
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": parameter
    };
}

/**
 * 构建可以删除数据库中表单的 SQL 语句
 * 
 * @param {TableDropOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _table_drop(options = {}) {
    let statement = "DROP TABLE";

    const { flag, table } = options;

    if (flag) statement = {
        "if-exists": "DROP TABLE IF EXISTS",
        "direct-drop": "DROP TABLE"
    } [ flag ] || statement;

    const sentence = template.replace(
        "{{statement}} {{table}}", {
            "table": quote(table),
            "statement": statement
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 构建可以在数据库中创建表单的 SQL 语句
 * 
 * @param {TableCreateOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _table_create(options = {}) {
    let statement = "CREATE TABLE";

    const part = [];
    const { name, flag, column: columns } = options;

    if (flag) statement = {
        "direct-create": "CREATE TABLE",
        "if-not-exists": "CREATE TABLE IF NOT EXISTS"
    } [ flag ] || statement;

    for (let index = 0; index < columns.length; index++) {
        const column = columns[index];

        part.push(
            parse_column(column)
        );
    }

    const sentence = template.replace(
        "{{statement}} {{table}} (\n{{column}}\n)", {
            "table": quote(name),
            "column": part.map(part => {
                return " ".repeat(indent) + part;
            }).join(",\n"),
            "statement": statement
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 构建可以在数据库中创建索引的 SQL 语句
 * 
 * @param {TableCreateOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _index_create(options = {}) {
    let statement = "CREATE";
    let flag = options.flag ?? [];

    const { name, table, column: column_list, order } = options;

    if (flag) {
        if (!Array.isArray(flag)) {
            flag = [ flag ];
        }

        if (flag.includes("unique")) {
            statement += " UNIQUE";
        }

        statement += " INDEX";

        if (flag.includes("if-not-exists")) {
            statement += " IF NOT EXISTS";
        }
    } else {
        statement += " INDEX";
    }

    const sentence = template.replace(
        "{{statement}} {{name}} ON {{table}} (\n{{column}}\n)", {
            "name": quote(name),
            "table": quote(table),
            "column": column_list.map(name => {
                return " ".repeat(indent) + name + (order ? " " + order.toUpperCase() : "");
            }).join(",\n"),
            "statement": statement
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 构建可以在数据库中删除现有索引的 SQL 语句
 * 
 * @param {IndexDropOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _index_drop(options = {}) {
    let statement = "DROP";

    let { name, flag } = options;

    if (flag) {
        if (!Array.isArray(flag)) {
            flag = [ flag ];
        }

        statement += " INDEX";

        if (flag.includes("if-exists")) statement += " IF EXISTS";
    } else {
        statement += " INDEX";
    }

    const sentence = template.replace(
        "{{statement}} {{name}}", {
            "name": quote(name),
            "statement": statement
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 构建可以操纵数据库标单结构的 SQL 语句
 * 
 * @param {TableAlterOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _table_alter(options = {}) {
    let sentence = "";

    const { target, operate, define } = options;

    if (target === "table") {
        if (operate === "rename") {
            sentence = template.replace(
                "ALTER TABLE {{table}} RENAME TO {{name}}", {
                    "name": quote(define.name),
                    "table": quote(define.table)
                }
            )
        }
    }

    if (target === "column") {
        if (operate === "rename") {
            sentence = template.replace(
                "ALTER TABLE {{table}} RENAME COLUMN {{old}} TO {{new}}", {
                    "old": quote(define.column.old),
                    "new": quote(define.column.new),
                    "table": quote(define.table),
                }
            );
        }

        if (operate === "add") {
            sentence = template.replace(
                "ALTER TABLE {{table}} ADD COLUMN {{define}}", {
                    "table": quote(define.table),
                    "column": quote(define.column),
                    "define": parse_column(
                        Object.assign({
                            "name": define.column
                        }, define.define)
                    )
                }
            );
        }
    }

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 构建可以执行保存点相关的 SQL 语句
 * 
 * @param {SavePointOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _savepoint(options = {}) {
    let statement;

    const { name, operate } = options;

    if ([ "create", "release", "rollback" ].includes(operate)) {
        statement = {
            "create": "SAVEPOINT",
            "release": "RELEASE SAVEPOINT",
            "rollback": "ROLLBACK TO SAVEPOINT"
        };
    }

    const sentence = template.replace(
        "{{statement}} {{name}}", {
            "name": name,
            "statement": statement
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 构建可以执行事务相关的 SQL 语句
 * 
 * @param {TransactionOptions} options 构建 SQL 语句的配置
 * @returns {GeneratorResponse} 构建器响应结果
 */
function _transaction(options = {}) {
    let sentence;

    const { operate } = options;

    if ([ "begin", "commit", "rollback" ].includes(operate)) {
        sentence = {
            "begin": "BEGIN TRANSACTION",
            "commit": "COMMIT",
            "rollback": "ROLLBACK"
        };
    }

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": {}
    };
}

/**
 * 通过一个 Error 实例化对象获取调用函数的名称
 * 
 * @param {Error} error 一个 Error 实例化
 * @param {number} depth 需要获取的目标调用者的调用栈深度
 * @param {(text: string) => string} extractor 提取器
 * @returns {string} 获取调用函数的名称
 */
function get_caller_name(error, depth = 2, extractor = text => {
    const match = text.match(/at ([\w.#]+)/);

    return match ? match[1] : "Unknown";
}) {
    return extractor(
        error.stack.split("\n")[depth]
    );
}

/**
 * 获取目前支持的生成器列表
 * 
 * @returns 目前支持的生成器列表
 */
export function get_generator() {
    return {
        "item": {
            "count": _item_count,
            "insert": _item_insert,
            "select": _item_select,
            "delete": _item_delete,
            "update": _item_update
        },
        "index": {
            "drop": _index_drop,
            "create": _index_create
        },
        "table": {
            "drop": _table_drop,
            "alter": _table_alter,
            "create": _table_create
        },
        "savepoint": _savepoint,
        "transaction": _transaction
    };
}

export class DatabaseOperator {
    /**
     * 活动定义
     */
    static action = {
        "request": "run",
        "execute": "all"
    };

    /**
     * 实例化 DatabaseOperator 类
     * 
     * @callback InstancePasser
     * @param {GeneralObject} config 传递的配置信息
     * @param {GeneratorResponse} result 构建器构建的响应结果
     * @param {any} response 经过 handler 之后的结果
     * @param {string} name 调用的方法的名称
     * @returns {void} 返回结果
     * 
     * @typedef {SQLite3.Database} DatabaseInstance
     * @typedef {(string|string[])} ListLike
     * @typedef {(SQLite3.RunResult|Object<string, SQLite3.RunResult>)} RunResult
     * 
     * @param {InstancePasser} passer 可以用于监听所有操作的回调函数
     * @param {DatabaseInstance} instance 操纵数据库的时候处理方法
     * @returns {DatabaseOperator} 实例化好的 DatabaseOperator 类
     */
    constructor(instance = new SQLite3(), passer) {
        this.passer = passer;

        this.instance = instance;
        /** @type {Map<string, SQLite3.Statement>} */
        this.statement = new Map();
        this.generator = get_generator();

        this.handler = (_, response) => response;
    }

    /**
     * 通用处理器
     * 
     * @param {GeneratorResponse} response 
     * @returns {SQLite3.RunResult} 处理结果
     */
    #processer(response) {
        /** @type {SQLite3.Statement} */
        let statement;

        const { action, sentence, parameter } = response;

        // console.log(response)

        if (this.statement.has(sentence)) {
            statement = this.statement.get(sentence);
        } else {
            statement = this.instance.prepare(sentence);

            this.statement.set(sentence, statement);
        }

        return statement[
            DatabaseOperator.action[action]
        ](parameter);
    }

    /**
     * 处理请求
     * 
     * @param {(...arg) => any} generator 构建语句时使用的构建器
     * @param {ListLike} list 需要处理的目标列表
     * @param {GeneralObject} options 处理目标时附带的配置项
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @param {(value: any) => any} parser 语句构建结果处理器
     * @returns 执行结果
     */
    #process(
        generator, list, options, handler,
        parser = value => ({ "table": value })
    ) {
        const result = [];

        if (!Array.isArray(list)) {
            list = [ list ];
        }

        for (let index = 0; index < list.length; index++) {
            const current = list[index], config = object_merge(
                options, parser(current)
            ), temp = generator(config), response = handler(
                config, temp
            );

            if (this.passer) this.passer(
                config, temp, response, get_caller_name(
                    new Error(), 2, text => {
                        const match = text.match(/at .*\.(\w+) \(/);
                        
                        return match ? match[1] : "Unknown";
                    }
                )
            );

            if (response) result.push({
                "target": current,
                "response": this.#processer(response)
            });
        }

        return result.length === 1 ? result[0].response : result;
    }

    /**
     * 读取数据库中的项目
     * 
     * @param {ListLike} list 需要读取的表的列表
     * @param {ItemCountOptions} options 传入的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    count_item(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.item.count, list,
            options, handler, name => ({
                "source": {
                    "table": name
                }
            })
        );
    }

    /**
     * 在数据库中的指定表中插入项目
     * 
     * @param {ListLike} list 要插入的表单的列表
     * @param {ItemInsertOptions} options 传入的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    insert_item(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.item.insert,
            list, options, handler
        );
    }

    /**
     * 读取数据库中的项目
     * 
     * @param {ListLike} list 需要读取的表的列表
     * @param {ItemSelectOptions} options 传入的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {GeneralObject[]} 执行结果
     */
    select_item(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.item.select, list,
            options, handler, name => ({
                "source": {
                    "table": name,
                    "select": "all"
                }
            })
        );
    }
    
    /**
     * 更新数据库已有的项目
     * 
     * @param {ListLike} list 需要改变的表单
     * @param {ItemUpdateOptions} options 传入的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    update_item(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.item.update,
            list, options, handler
        );
    }

    /**
     * 删除数据库已有的项目
     * 
     * @param {ListLike} list 需要改变的表单
     * @param {ItemUpdateOptions} options 传入的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    delete_item(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.item.delete,
            list, options, handler
        );
    }

    /**
     * 在当前数据库中删除表单
     * 
     * @param {ListLike} list 删除的表单的名称
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    drop_table(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.table.drop,
            list, options, handler
        );
    }

    /**
     * 在当前数据库中调整表单
     * 
     * @param {ListLike} list 调整的表单的名称
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    alter_table(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.table.alter, list, options, handler
        );
    }

    /**
     * 在当前数据库中创建表单
     * 
     * @param {ListLike} table 创建的表单的名称
     * @param {TableCreateOptions} options 创建时传递的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    create_table(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.table.create, list, options,
            handler, value => ({ "name": value })
        );
    }

    /**
     * 在当前数据库中删除索引
     * 
     * @param {ListLike} list 删除的索引的名称
     * @param {IndexDropOptions} options 创建时传递的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    drop_index(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.index.drop, list, options,
            handler, value => ({ "name": value })
        );
    }

    /**
     * 在当前数据库中创建索引
     * 
     * @param {ListLike} table 创建的索引的名称
     * @param {IndexCreateOptions} options 创建时传递的配置
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    create_index(list, options = {}, handler = this.handler) {
        return this.#process(
            this.generator.index.create, list, options,
            handler, value => ({ "name": value })
        );
    }

    /**
     * 实现基础保存点操作
     * 
     * @param {ListLike} list 保存点的名称
     * @param {("create"|"release"|"rollback")} operate 需要进行的操作
     * @returns {RunResult} 执行结果
     */
    savepoint(list, options, handler = this.handler) {
        return this.#process(
            this.generator.savepoint, list, options,
            handler, value => ({ "name": value })
        );
    }

    /**
     * 实现基础事务操作
     * 
     * @param {("begin"|"commit"|"rollback")} operate 需要进行的操作
     * @returns {RunResult} 执行结果
     */
    transaction(operate, handler = this.handler) {
        return this.#process(
            this.generator.transaction, [operate],
            { operate }, handler, value => value
        );
    }
}

export default DatabaseOperator;