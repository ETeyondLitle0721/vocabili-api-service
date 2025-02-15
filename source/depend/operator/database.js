import SQLite3 from "better-sqlite3";
import template from "../utilities/template.js";
import { quote_string, unique_array, generate_random_string as generate, repair_character as repair, get_type, to_string } from "../core.js";

/**
 * @typedef {("<"|">"|"<="|">="|"<>")} GeneralOperator
 * @typedef {(number|string|boolean)} NormalType
 * @typedef {Object<string, NormalType>} GeneralObject
 * 
 * @typedef GeneralGeneratorResponse
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
 * @property {("like"|"equal"|"range"|"within"|GeneralOperator)} operator 运算符
 * @property {(GeneralObject|NormalType[])} value 取值
 * 
 * @typedef ItemSelectWhereGroupOptions
 * @property {("or"|"and")} joiner 多个表达式之间的连接符
 * @property {(ItemSelectWhereSingleOptions|ItemSelectWhereSingleOptions[])} children 表达式列表
 * 
 * @typedef {(ItemSelectWhereSingleOptions|ItemSelectWhereSingleOptions[]|ItemSelectWhereGroupOptions)} ItemSelectWhereOptions
 * 
 * @typedef ItemSelectOptions
 * @property {object} source 定义查询来源的配置项目
 * @property {string[]} source.select 选中的列的名称
 * @property {string} source.table 需要查询的表
 * @property {ItemSelectWhereOptions} where 选中项目所需达成的条件
 * @property {object} control 控制配置项
 * @property {object} control.order 排序控制项
 * @property {string} control.order.column 依据字段
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
 * @param {GeneralGeneratorResponse} response 语句构建器响应结果
 * @returns {GeneralGeneratorResponse} 经过处理的语句
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
 */

/**
 * 生成 Nickname 并添加到映射对象
 * 
 * @param {string} column_name 列名称
 * @param {number} index 索引值
 * @param {NormalType} value 真实值
 * @param {string} sequence 用于区别不同子序列的顺序码
 * @param {ParameterCallback} setter 添加映射对象的回调方法
 * @returns {string} 生成的 Nickname 字符串
 */
function generate_placeholder(column_name, index, value, sequence, setter) {
    let nickname = `Value_${column_name.toUpperCase()}_${repair(index + 1, 4, "0")}_${sequence}`;

    setter(
        value, nickname, column_name
    );

    return ":" + nickname;
}

/**
 * 生成随机的顺序码
 * @returns {string} 随机生成的顺序码
 */
function generate_sequence() {
    return generate("?".repeat(8), "0123456789QAZWSXEDCRFVTGBYHNUJMIKOLP");
}

/**
 * 解析 Where 语句配置信息为 SQL 语句
 * 
 * @typedef ParseWhereCallbackOptions
 * @property {ParameterCallback} parameter 添加参数映射关系的回调方法
 * 
 * @param {ItemSelectWhereOptions} options 需要解析的 Where 语句配置信息
 * @param {ParseWhereCallbackOptions} callback 回调方法
 * @returns {string} 解析出来的 SQL 语句
 */
function parse_where(options = {}, callback = {}) {
    if (get_type(options).second === "array") {
        return parse_where({
            "joiner": "and",
            "children": options
        }, callback);
    }

    if (get_type(options.children).second === "array") {
        let { joiner = "and", children = [] } = options, part = [];

        for (let index = 0; index < children.length; index++) {
            part.push(parse_where(
                children[index], callback
            ));
        }

        return `(${part.join(` ${joiner.toUpperCase()} `)})`;
    }

    let { mark, value, column, operator } = options, result = "";
    let seq_id = generate_sequence();

    if (operator === "equal") {
        let part = [];

        if (get_type(value).second !== "array") {
            value = [value];
        }

        for (let index = 0; index < value.length; index++) {
            part.push(`${quote_string(column, "double")} = ${generate_placeholder(
                column, index, value[index], seq_id, callback.parameter
            )}`);
        }

        result = part.join(", ");
    }

    if (operator === "like") {
        result = `${quote_string(column, "double")} LIKE ${generate_placeholder(
            column, 0, value, seq_id, callback.parameter
        )}`;
    }

    if (operator === "range") {
        result = `${quote_string(column, "double")} BETWEEN ${generate_placeholder(
            column, 0, value.minimum, seq_id, callback.parameter
        )} AND ${generate_placeholder(
            column, 1, value.maximum, seq_id, callback.parameter
        )}`;
    }

    if (operator === "within") {
        if (get_type(value).second !== "array") {
            value = [value];
        }

        result = `${quote_string(column, "double")} IN ( ${value.map((item, index) => generate_placeholder(
            column, index, item, seq_id, callback.parameter
        )).join(", ")} )`;
    }

    if ([">", ">=", "<", "<=", "<>"].includes(operator)) {
        result = `${quote_string(column, "double")} ${operator} ${generate_placeholder(
            column, 0, value, seq_id, callback.parameter
        )}`;
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
 * @param {ParameterCallback} callback 回调方法
 * @returns {string} 解析出来的 SQL 元组
 */
function parse_tuple(tuple = {}, callback = {}) {
    let seq_id = generate_sequence();

    return "( " + tuple.map((item, index) => generate_placeholder(
        item[0], index, item[1], seq_id, callback
    )).join(", ") + " )";
}

/**
 * 构建用于向数据库中的表单之中插入项目的 SQL 语句
 * 
 * @param {ItemInsertOptions} options 构建插入语句时的构建参数
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _item_insert(options = {}) {
    let { flag, table, target = [] } = options;
    let replacer = {
        "statement": "INSERT"
    }, parameter = {}, value = [], column = [];

    if (!Array.isArray(target)) {
        target = [target];
    }

    replacer.table = quote_string(table, "double");

    if (flag) {
        replacer.statement = {
            "direct-insert": replacer.statement,
            "if-not-exists": "INSERT OR IGNORE",
            "if-exists-replace": "INSERT OR REPLACE"
        }[flag] || replacer.statement;
    }

    // console.log(target)

    for (let index = 0; index < target.length; index++) {
        target[index] ? value.push(parse_tuple(
            Object.entries(target[index]), (real, nickname, name) => {
                column.push(name);
                parameter[nickname] = real;
            }
        )) : false;
    }

    let sentence = template.replace(
        "{{statement}} INTO {{table}} ( {{column}} ) VALUES {{value}}", {
            ...replacer,
            "value": value.join(", "),
            "column": unique_array(column).map(name => {
                return quote_string(name, "double");
            }).join(", ")
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": parameter
    };
}

/**
 * 构建可以在数据库中的表单之中索引符合目标要求的项目的 SQL 语句
 * 
 * @param {ItemSelectOptions} options 构建检索语句时的构建参数
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _item_select(options = {}) {
    let { where = {}, source = {}, control = {} } = options;
    let part = [], parameter = {};

    let param_setter = (real, nickname) => {
        parameter[nickname] = real;
    };

    if (source.select === "all") {
        part.push("SELECT *");
    } else {
        part.push("SELECT " + source.select.map(item => {
            return quote_string(item, "double");
        }).join(", "));
    }

    part.push("FROM " + quote_string(source.table, "double"));

    if (Object.keys(where).length > 0) part.push("WHERE " + parse_where(where, {
        "parameter": param_setter
    }));

    if (control.order) {
        let { column, method } = control.order;

        part.push("ORDER BY " + quote_string(column, "double") + " " + {
            "ascending": "asc", "descending": "desc"
        } [ method ]);
    }

    if (control.result) {
        let { limit, offset } = control.result;
        let seq_id = generate_sequence(), index = 0;

        if (limit) {
            part.push("LIMIT " + generate_placeholder(
                "LIMIT", ++index, limit, seq_id, param_setter
            ));

            if (!offset) {
                part.push("OFFSET 0");
            }
        }

        if (offset) {
            part.push("OFFSET " + generate_placeholder(
                "OFFSET", ++index, offset, seq_id, param_setter
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
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _item_count(options = {}) {
    let { where = {}, source = {} } = options;
    let part = [], parameter = {};

    let param_setter = (real, nickname) => {
        parameter[nickname] = real;
    };

    part.push("SELECT (*)");
    part.push("FROM " + quote_string(source.table, "double"));

    part.push("WHERE " + parse_where(where, {
        "parameter": param_setter
    }));

    return {
        "action": "request",
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
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _item_delete(options = {}) {
    let parameter = {};

    return {
        "action": "request",
        "sentence": template.replace(
            "DELETE FROM {{table}} WHERE {{where}}", {
                "table": quote_string(options.table, "double"),
                "where": parse_where(
                    options.target, {
                        "parameter": (real, nickname) => {
                            parameter[nickname] = real;
                        }
                    }
                )
            }
        ),
        "parameter": parameter
    };
}

/**
 * 构建可以更新数据库中的表单的记录的 SQL 语句
 * 
 * @param {ItemUpdateOptions} options 构建 SQL 语句的配置
 * @param {GeneralObject} options.data 更新为的数据
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _item_update(options = {}) {
    let { table, target = {}, data = {} } = options;
    let part = [], parameter = {}, seq_id = generate_sequence();

    let entries = Object.entries(data), param_setter = (real, nickname) => {
        parameter[nickname] = real;
    };

    for (let index = 0; index < entries.length; index++) {
        let entry = entries[index];
        
        part.push(`${quote_string(entry[0], "double")} = ${generate_placeholder(
            entry[0], index, entry[1], seq_id, param_setter
        )}`);
    }

    let sentence = template.replace(
        "UPDATE {{table}} SET {{value}} WHERE {{where}}", {
            "table": quote_string(table, "double"),
            "value": part.join(", "),
            "where": parse_where(target, {
                "parameter": param_setter
            })
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
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _table_drop(options = {}) {
    let { flag, table } = options;
    let statement = "DROP TABLE";

    if (flag) {
        statement = {
            "if-exists": "DROP TABLE IF EXISTS",
            "direct-drop": "DROP TABLE"
        } [ flag ] || statement;
    }

    return {
        "action": "request",
        "sentence": template.replace(
            "{{statement}} {{table}}", {
                "statement": statement,
                "table": quote_string(table, "double")
            }
        ),
        "parameter": {}
    };
}

/**
 * 构建可以在数据库中创建表单的 SQL 语句
 * 
 * @param {TableCreateOptions} options 构建 SQL 语句的配置
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _table_create(options = {}) {
    let { name, flag, column: column_list } = options;
    let statement = "CREATE TABLE", part = [], parameter = {};

    if (flag) {
        statement = {
            "direct-create": "CREATE TABLE",
            "if-not-exists": "CREATE TABLE IF NOT EXISTS"
        } [ flag ] || statement;
    }

    // let seq_id = generate_sequence();

    for (let index = 0; index < column_list.length; index++) {
        let column = column_list[index], constraint = [];
        let { mark = [], value: { default: value, restrict = [] } } = column;

        if (get_type(mark).second !== "array") mark = [ mark ];
        if (get_type(restrict).second !== "array") restrict = [ restrict ];

        // if (value !== undefined) constraint.push("DEFAULT " + generate_placeholder(
        //     column.name, index, value, seq_id, (real, nickname) => {
        //         parameter[nickname] = real;
        //     }
        // ));

        // CREATE TABLE 不涉及数据操作，不能使用参数化绑定

        if (value !== undefined) {
            if (get_type(value).first === "string") {
                value = quote_string(value, "single");
            }

            constraint.push("DEFAULT " + to_string(value));
        };

        if (mark.includes("primary-key")) constraint.push("PRIMARY KEY");
        if (mark.includes("auto-increment")) constraint.push("AUTOINCREMENT");

        if (restrict.includes("unique")) constraint.push("UNIQUE");
        if (restrict.includes("not-null")) constraint.push("NOT NULL");

        part.push(template.replace(
            "{{column}} {{type}} {{constraint}}", {
                "column": quote_string(column.name, "double"),
                "type": column.value.type.toUpperCase(),
                "constraint": constraint.join(" ")
            }
        ).trimEnd());
    }

    let sentence = template.replace(
        "{{statement}} {{table}} (\n{{column}}\n)", {
            "table": quote_string(name, "double"),
            "column": part.map(part => "    " + part).join(",\n"),
            "statement": statement
        }
    );

    return {
        "action": "request",
        "sentence": sentence,
        "parameter": parameter
    };
}

/**
 * 构建可以在数据库中创建索引的 SQL 语句
 * 
 * @param {TableCreateOptions} options 构建 SQL 语句的配置
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _index_create(options = {}) {
    let { name, flag, table, column: column_list } = options;
    let statement = "CREATE";

    if (flag) {
        if (!Array.isArray(flag)) flag = [ flag ];

        if (flag.includes("unique")) statement += " UNIQUE";

        statement += " INDEX";

        if (flag.includes("if-not-exists")) statement += " IF NOT EXISTS";
    } else {
        statement += " INDEX";
    }

    let sentence = template.replace(
        "{{statement}} {{name}} ON {{table}} (\n{{column}}\n)", {
            "name": quote_string(name, "double"),
            "table": quote_string(table, "double"),
            "column": column_list.map(name => "    " + name).join(",\n"),
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
 * @returns {GeneralGeneratorResponse} 构建器响应结果
 */
function _index_drop(options = {}) {
    let { name, flag } = options;
    let statement = "DROP";

    if (flag) {
        if (!Array.isArray(flag)) flag = [ flag ];

        statement += " INDEX";

        if (flag.includes("if-exists")) statement += " IF EXISTS";
    } else {
        statement += " INDEX";
    }

    let sentence = template.replace(
        "{{statement}} {{name}}", {
            "name": quote_string(name, "double"),
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
 * 获取目前支持的生成器列表
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
            "create": _table_create
        }
    };
}

export class DatabaseOperator {
    /**
     * 实例化 DatabaseOperator 类
     * 
     * @typedef {SQLite3.Database} DatabaseInstance
     * @typedef {(string|string[])} ListLike
     * @typedef {(SQLite3.RunResult|Object<string, SQLite3.RunResult>)} RunResult
     * 
     * @param {DatabaseInstance} instanse 操纵数据库的时候处理方法
     * @returns {DatabaseOperator} 实例化好的 DatabaseOperator 类
     */
    constructor(instanse = new SQLite3()) {
        this.instanse = instanse;
        this.generator = get_generator();
    }

    /**
     * 通用处理器
     * 
     * @param {GeneralGeneratorResponse} response 
     * @returns {SQLite3.RunResult} 处理结果
     */
    #processer(response) {
        // console.log(response);

        return this.instanse.prepare(response.sentence)[{
            "request": "run",
            "execute": "all"
        } [ response.action ]](response.parameter);
    }

    /**
     * 处理请求
     * 
     * @param {(...arg)=>any} generator 构建语句时使用的构建器
     * @param {(string|string[])} list 需要处理的目标列表
     * @param {GeneralObject} options 处理目标时附带的配置项
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @param {(value: any)=>any} parser 语句构建结果处理器
     * @returns 执行结果
     */
    #process(generator, list, options, handler, parser = (value) => ({ "table": value })) {
        let result = [];

        if (get_type(list).second !== "array") {
            list = [ list ];
        }

        for (let index = 0; index < list.length; index++) {
            let current = list[index], config = Object.assign(options, 
                parser(current)
            ), response = handler(
                config, generator(config)
            );

            if (response) result.push({
                "target": current, "response": this.#processer(
                    response
                )
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
    count_item(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.item.count, list, options, handler
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
    insert_item(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.item.insert, list, options, handler
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
    select_item(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.item.select, list, options, handler, name => ({
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
    update_item(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.item.update, list, options, handler
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
    delete_item(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.item.delete, list, options, handler
        );
    }

    /**
     * 在当前数据库中删除表单
     * 
     * @param {ListLike} list 删除的表单的名称
     * @param {ResponseHandler} handler 语句构建结果处理器
     * @returns {RunResult} 执行结果
     */
    drop_table(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.table.drop, list, options, handler
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
    create_table(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.table.create, list, options, handler
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
    drop_index(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.index.drop, list, options, handler, value => ({
                "name": value
            })
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
    create_index(list, options = {}, handler = (_options, response) => response) {
        return this.#process(
            this.generator.index.create, list, options, handler, value => ({
                "name": value
            })
        );
    }
}

export default DatabaseOperator;