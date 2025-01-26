import ansi from "../../utilities/sequence/ansi.js";
import duration from "../../toolkit/formatter/duration.js";
import { number_to_string as nts } from "../../core.js";

/**
 * @callback ReportMessagePrinter
 * @param {string} text 需要打印的文本信息
 * @param {TaskProgressReporter} task 实例化的 TaskProgressReporter 类
 * 
 * @typedef TaskInfo
 * @property {object} timing 任务的 Timing 信息
 * @property {number} timing.used 任务用时（从第一个子任务开始到最后一个子任务完成的时间差，如果未完成则是到当前的时间差）
 * @property {number} timing.last 最后一个子任务完成的时间
 * @property {number} timing.first 第一个子任务完成的时间
 * @property {number} timing.start 任务开始的时间
 * @property {number} timing.create 任务创建时间
 * @property {object} task 任务的统计信息
 * @property {number} task.eta 任务完成预计剩余时间（使用任务完成速率计算出来的，单位为毫秒）
 * @property {number} task.speed 任务完成速率（使用滑动窗口平均数据算出来的结果）
 * @property {number} task.total 任务总数
 * @property {number} task.precent 任务的完成百分比
 * @property {number} task.complete 任务完成数
 * 
 * @callback ReporterTickEventCallback
 * @param {("finish"|"success")} type 事件完成类别
 * @param {TaskProgressReporter} reporter 当前的 TaskProgressReporter 实例化对象
 * 
 * @callback ReporterStartEventCallback
 * @param {TaskProgressReporter} reporter 当前的 TaskProgressReporter 实例化对象
 * 
 * @callback ReporterFinishEventCallback
 * @param {TaskProgressReporter} reporter 当前的 TaskProgressReporter 实例化对象
 */

export class TaskProgressReporter {
    /** 打印时填充进度条已完成部分使用的字符（推荐设为一个长度的字符串） */
    static char = "▇";
    /** 打印时展示进度的刻度数目（推荐 64 个刻度） */
    static scale = 64;

    /**
     * 实例化 TaskProgressReporter 类
     * 
     * @param {number} total 任务总量
     * @param {number} sample 计算平均完成速率的时候使用样本数量
     * @param {number} interval 任务进度汇报时间间隔（毫秒数）
     * @param {ReportMessagePrinter} printer 任务完成进度报告器（打印机）
     * 
     * @returns {TaskProgressReporter} 实例化的 TaskProgressReporter 类
     */
    constructor(total, sample = 64, interval = 250, printer = (text) => console.log(text)) {
        this.printer = printer;
        this.timeline = {
            /** @type {number[]} */
            "list": [],
            /** @type {number} */
            "first": null
        };

        this.task = {
            "stat": {
                "failed": 0,
                "success": 0
            },
            "total": total,
            "complete": 0
        };
        this.config = {
            "sample": sample,
            "report": {
                "task_id": null,
                "interval": interval
            }
        };
        this.callback = {};
        this.timestamp = {
            "create": Date.now()
        };
    }

    /**
     * 开始任务处理
     * 
     * @param {("report"|"no-report")} start 是否同步开启任务进度定时汇报
     * 
     * @returns {number} 任务开始的时间戳
     */
    start(start = "report") {
        this.timestamp.start = Date.now();

        if (start) {
            this.action("start-report");
        }

        if (this.callback.start) {
            this.callback.start(this);
        }

        return this.timestamp.start;
    }
    
    /**
     * 获取任务进度信息
     *  
     * @returns {TaskInfo} 获取到的任务信息
     */
    info() {
        let sample = this.timeline.list;

        let result = {
            "task": {
                "stat": this.task.stat,
                "total": this.task.total,
                "precent": this.task.complete / this.task.total * 100,
                "complete": this.task.complete
            },
            "timing": {
                "last": this.timeline.list.at(-1),
                "first": this.timeline.first,
                "start": this.timestamp.start,
                "create": this.timestamp.create
            }
        };

        result.task.speed = sample.length / (Date.now() - sample[0]);

        // console.log(result.task.speed * 1000);

        if (result.task.complete >= result.task.total) {
            result.task.eta = 0, result.timing.used = sample.at(-1) - this.timeline.first;
        } else {
            result.timing.used = Date.now() - this.timeline.first;
            result.task.eta = result.timing.used / (result.task.precent / 100) - result.timing.used;
        }

        return result;
    }

    /**
     * 广播单个任务完成的信息
     * 
     * @param {("failed"|"success")} tick_type 此次任务完成的反馈类别
     * @param {("auto-stop"|"no-stop")} auto_stop 是否自动停止任务进度定时汇报程序
     * 
     * @returns {number} 任务完成时间
     */
    tick(tick_type = "success", auto_stop = "auto-stop") {
        this.task.complete++;

        if (this.task.complete === 1) {
            this.timeline.first = Date.now();
        }

        this.timeline.list.push(Date.now());
        
        if (this.timeline.list.length > this.config.sample) {
            this.timeline.list.shift();
        }

        if (this.callback.tick) {
            this.callback.tick(tick_type, this);
        }

        if (this.task.complete === this.task.total && auto_stop === "auto-stop") {
            this.printer(
                this.report(), this
            );
            this.action("stop-report");

            if (this.callback.finish) {
                this.callback.finish(this);
            }
        }

        if ([ "failed", "success" ].includes(tick_type)) {
            this.task.stat[tick_type]++;
        }

        return this.timeline.list.at(-1);
    }

    /**
     * 取得具有任务完成进度信息的文本
     * 
     * @returns {string} 具有任务完成进度信息的文本
     */
    report() {
        let info = this.info(), precent, progress, speed, eta;
        let _scale = TaskProgressReporter.scale;

        if (info.task.complete < 1) {
            precent = "---.---", eta = "--:--:--.---";
            speed = "--.----", progress = " ".repeat(_scale);
        } else {
            let scale = info.task.precent / 100 * _scale;
            let failed = TaskProgressReporter.char.repeat(
                parseInt(this.task.stat.failed / this.task.total * _scale)
            );

            speed = nts(info.task.speed * 1000, 7);
            precent = nts(info.task.precent, 7);
            progress = TaskProgressReporter.char.repeat(
                Math.min(scale, _scale)
            ).padEnd(_scale, " ").replace(failed, ansi.encode({
                "text": failed, "color": {
                    "foreground": "red"
                }
            }));

            eta = duration(info.task.eta, {
                "origin": "millisecond",
                "target": "hour"
            }, "{{hour, 2}}:{{minute, 2}}:{{second, 2}}.{{millisecond, 3}}");
        }

        if (eta.length > "--:--:--.---".length) {
            eta = "--:--:--.---";
        }
    
        return `[${precent}%] ${progress} (V= ${speed} it/sec, T= ${eta})`;
    }

    /**
     * 执行动作
     * 
     * @typedef ActionReturn
     * @property {(object|null)} data 执行任务获取到的数据
     * @property {number} timestamp 当前的毫秒级时间戳
     * 
     * @param {("start-report"|"stop-report")} name 动作名称
     * 
     * @returns {ActionReturn} 响应值
     */
    action(name) {
        let result = null;

        if (name === "start-report") {
            if (this.config.report.task_id) {
                console.warn("任务进度定时汇报程序已处于运行状态");
            }

            this.config.report.task_id = setInterval(() => { 
                this.printer(
                    this.report(), this
                );
            }, this.config.report.interval);
        }

        if (name === "stop-report") {
            if (!this.config.report.task_id) {
                console.warn("任务进度定时汇报程序未处于运行状态");
            }

            clearInterval(this.config.report.task_id);

            this.config.report.task_id = null;
        }

        return {
            "data": result,
            "timestamp": Date.now()
        };
    }

    /**
     * 注册事件发生时的回调方法
     * 
     * @param {("tick"|"start"|"finish")} event 要注册的事件名称
     * @param {(ReporterTickEventCallback|ReporterFinishEventCallback)} callback 
     */
    on(event, callback) {
        if ([ "tick", "start", "finish" ].includes(event)) {
            this.callback[event] = callback;

            return this;
        }

        throw new Error("'event' 参数的传参必须为 'tick', 'start', 'finish' 之中的一个。");
    }
}

export default TaskProgressReporter;