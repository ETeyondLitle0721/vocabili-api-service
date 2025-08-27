import * as ansi from "../utilities/sequence/ansi.js";
import * as datetime from "./datetime.js";

const _console = console;

const df_time = "{{hour, 2}}:{{minute, 2}}:{{second, 2}}.{{ms, 3}}";

export default {
    ..._console,

    tlog(...args) {
        const prefix = ansi.encode({
            "text": datetime.format(
                `[${df_time}]`, new Date()
            ),
            "flags": [
                "fg-color:green"
            ]
        });

        args.unshift(prefix);

        return this.log(...args);
    },

    elog(...arg) {
        const parse_flags = ansi.parse.sgr.flags;

        const prefix = parse_flags(
            [ "bg-color:red" ]
        );

        const suffix = parse_flags(
            [ "text-style:reset" ]
        );

        return this.log(prefix, ...arg, suffix);
    },

    ilog(...arg) {
        const parse_flags = ansi.parse.sgr.flags;

        const prefix = parse_flags(
            [ "bg-color:yellow" ]
        );

        const suffix = parse_flags(
            [ "text-style:reset" ]
        );

        return this.log(prefix, ...arg, suffix);
    }
};