import template from "../depend/template.js";
import { quote_string as quote } from "../depend/base.js";

export const get = {
    /**
     * 获取数据库的日志模式
     * 
     * @returns 执行结果
     */
    "journal_mode": () => {
        const sentence = template.replace(
            "PRAGMA journal_mode", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 获取数据库与文件系统的数据同步强度
     * 
     * @returns 执行结果
     */
    "synchronous": () => {
        const sentence = template.replace(
            "PRAGMA synchronous", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    "table": {
        /**
         * 获取表的信息
         * 
         * @param {string} table 表名称
         * @returns 执行结果
         */
        "info": (table) => {
            const sentence = template.replace(
                "PRAGMA table_info({{table}})", {
                    "table": quote(table, "double")
                }
            );

            return {
                "action": "request",
                "sentence": sentence,
                "parameter": {}
            };
        },

        /**
         * 获取表的外键约束信息
         * 
         * @param {string} table 表名称
         * @returns 执行结果
         */
        "foreign_key_list": (table) => {
            const sentence = template.replace(
                "PRAGMA foreign_key_list({{table}})", {
                    "table": quote(table, "double")
                }
            );

            return {
                "action": "request",
                "sentence": sentence,
                "parameter": {}
            };
        },
    },

    "list": {
        /**
         * 获取表的索引
         * 
         * @param {string} table 表名称
         * @returns 执行结果
         */
        "index": (table) => {
            const sentence = template.replace(
                "PRAGMA index_list({{table}})", {
                    "table": quote(table, "double")
                }
            );

            return {
                "action": "request",
                "sentence": sentence,
                "parameter": {}
            };
        },

        /**
         * 获取支持的核对方法
         * 
         * @returns 执行结果
         */
        "collation": () => {
            const sentence = template.replace(
                "PRAGMA collation_list", {}
            );

            return {
                "action": "request",
                "sentence": sentence,
                "parameter": {}
            };
        },
    },

    /**
     * 获取是否启用外键约束
     * 
     * @returns 执行结果
     */
    "foreign_keys": () => {
        const sentence = template.replace(
            "PRAGMA foreign_keys", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 获取临时文件存储的方式
     * 
     * @returns 执行结果
     */
    "temp_store": () => {
        const sentence = template.replace(
            "PRAGMA temp_store", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 获取数据库的忙碌重试超时时间（单位：毫秒）
     * 
     * @returns 执行结果
     */
    "busy_timeout": () => {
        const sentence = template.replace(
            "PRAGMA busy_timeout", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 获取数据库的缓存大小（单位：页）
     * 
     * @returns 执行结果
     */
    "cache_size": () => {
        const sentence = template.replace(
            "PRAGMA cache_size", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    }
};

export const run = {
    /**
     * 清空数据库
     * 
     * @returns 执行结果
     */
    "vacuum": () => {
        const sentence = "VACUUM";

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 优化数据库
     * 
     * @returns 执行结果
     */
    "optimize": () => {
        const sentence = template.replace(
            "PRAGMA optimize", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 检查数据库完整性
     * 
     * @returns 执行结果
     */
    "integrity_check": () => {
        const sentence = template.replace(
            "PRAGMA integrity_check", {}
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    }
};

export const set = {
    /**
     * 设置数据库的日志模式
     * 
     * @param {("default"|"delete"|"truncate"|"persist"|"wal")} mode 日志模式
     * @returns 执行结果
     */
    "journal_mode": (mode) => {
        if (mode === "default") {
            mode = "delete";
        }

        mode = mode.toUpperCase();

        const sentence = template.replace(
            "PRAGMA journal_mode = {{mode}}", {
                "mode": quote(mode, "double")
            }
        );

        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        };
    },

    /**
     * 设置数据库的忙碌重试超时时间（单位：毫秒）
     * 
     * @param {(number|"default")} timeout 超时时间（单位：毫秒）
     * @returns 执行结果
     */
    "busy_timeout": (timeout) => {
        if (timeout === "default") {
            timeout = 0;
        }

        const sentence = template.replace(
            "PRAGMA busy_timeout = {{timeout}}", {
                "timeout": timeout
            }
        );
    
        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        }
    },

    /**
     * 设置数据库与文件系统的数据同步强度
     * 
     * @param {("default"|"off"|"full"|"normal")} level 强度
     * @returns 执行结果
     */
    "synchronous": (level) => {
        if (level === "default") {
            level = "off";
        }

        level = level.toUpperCase();

        const sentence = template.replace(
            "PRAGMA synchronous = {{level}}", {
                "level": level
            }
        );
    
        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        }
    },

    /**
     * 设置数据库的缓存大小（单位：页）
     * 
     * @param {(number|"default")} cache_size 缓存大小（单位：页）
     * @returns 执行结果
     */
    "cache_size": (cache_size) => {
        if (cache_size === "default") {
            cache_size = 2000;
        }
        
        const sentence = template.replace(
            "PRAGMA cache_size = {{size}}", {
                "size": cache_size
            }
        );
    
        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        }
    },

    /**
     * 设置是否启用外键约束
     * 
     * @param {("default"|"on"|"off")} value 启用状态
     * @returns 执行结果
     */
    "foreign_keys": (value) => {
        if (value === "default") {
            value = "on";
        }

        value = value.toUpperCase();

        const sentence = template.replace(
            "PRAGMA foreign_keys = {{value}}", {
                "value": value
            }
        );
    
        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        }
    },

    /**
     * 设置数据库的临时文件储存方式
     * 
     * @param {("default"|"file"|"memory")} value 启用状态
     * @returns 执行结果
     */
    "temp_store": (value) => {
        if (value === "default") {
            value = "file";
        }

        const mapping = {
            "default": 0,
            "file": 1,
            "memory": 2
        };

        value = mapping[value];

        const sentence = template.replace(
            "PRAGMA temp_store = {{value}}", {
                "value": value
            }
        );
    
        return {
            "action": "request",
            "sentence": sentence,
            "parameter": {}
        }
    }
};