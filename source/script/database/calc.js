/**
 * @typedef ICOffsetStat
 * @property {number} like 点赞
 * @property {number} coin 投币
 * @property {number} view 观看
 * @property {number} favorite 收藏
 * 
 * @typedef {(ICOffsetStat & { "_": number })} ICPoint
 * @typedef {(ICOffsetStat & { "state": number })} ICRate
 * 
 * @typedef ICRegisterHandlerResult
 * @property {ICRate} rate 变化量比率信息
 * @property {ICPoint} point 变化量得点信息
 * @property {{ "_": number, "a": number, "b": number, "c": number }} fix 补正值信息
 * 
 * @callback ICJudger
 * @param {number} issue 目标刊物的看数
 * @returns {boolean} 是否可以使用此计算程序计算
 * 
 * @callback ICHandler
 * @param {ICOffsetStat} offset 目标统计量变化信息
 * @returns {ICRegisterHandlerResult} 计算结果
 * 
 * @typedef {Map<string, { judger: ICJudger, handler: ICHandler }>} ICAlgorithmMap
 */

export class InformationCalculator {
    /**
     * 实例化 InformationCalculator 对象
     * 
     * @returns {InformationCalculator} 实例化的 InformationCalculator 对象
     */
    constructor() {
        /** @type {ICAlgorithmMap}  */
        this.algorithm = new Map();
    }

    /**
     * 注册新的补正值计算程序
     * 
     * @param {string} name 补正值计算程序的名称
     * @param {ICJudger} judger 判断是否适用的回调方法
     * @param {ICHandler} handler 计算信息的回调方法
     * @returns 经过修改的计算程序映射表
     */
    register(name, judger, handler) {
        return this.algorithm.set(name, {
            judger, handler
        });
    }

    /**
     * 进行计算
     * 
     * @param {number} issue 目标数据的期数
     * @param {ICOffsetStat} offset 目标统计量变化信息
     * @param {number} copyright 目标版权状态
     * @returns {ReturnType<ICHandler>} 返回结果
     */
    calculate(issue, offset, copyright) {
        for (let [ _, { judger, handler } ] of this.algorithm) {
            if (judger(issue)) return handler(
                offset, copyright
            );
        }

        return null;
    }
}

/**
 * 获取通用得点信息
 * 
 * @param {ICRate} rate 比率信息
 * @param {ICOffsetStat} offset 目标统计量变化信息
 * @returns {ICPoint} 计算出来的得点信息
 */
export function get_point(rate, offset) {
    const { view, coin, like, favorite } = offset;

    const point = {
        "view": view * rate.view,
        "coin": coin * rate.coin,
        "like": like * rate.like,
        "favorite": favorite * rate.favorite
    };

    return Object.assign(
        point, {
            "_": Math.floor(point.view + point.coin + point.like + point.favorite)
        }
    );
}

const calculator = new InformationCalculator();

calculator.register("calculator-0001", issue => issue <= 20240711, offset => {
    const { view, coin, like, favorite } = offset;

    const rate = {
        "view": view <= 0 ? 0 : Math.ceil(((coin + favorite + like) / view) * 100) / 100,
        "coin": coin <= 0 ? 0 : Math.min(40, Math.ceil((coin * 100 + view) / (coin * 100) * 10 * 100) / 100),
        "like": like * 20 + view <= 0 ? 0 : Math.floor(((coin + favorite) * 100) / (like * 20 + view) * 100) / 100,
        "favorite": favorite * 20 + view <= 0 ? 0 : Math.min(20, Math.ceil(favorite * 20 / (favorite * 20 + view) * 100) / 100)
    };

    return {
        "fix": {
            "_": 1, "a": 1, "b": 1, "c": 1
        }, rate, "point": get_point(
            rate, offset
        )
    };
});

calculator.register("calculator-0002", issue => issue >= 20240712 && issue <= 20241101, (offset, copyright) => {
    const { view, coin, like, favorite } = offset, state = [ 1, 3 ].includes(copyright) ? 1 : 2;

    const rate = {
        "view": view <= 0 ? 0 : Math.max(1, Math.ceil(((coin + favorite * 20) / view * 100) / 100)),
        "coin": state * coin * 40 + view <= 0 ? 0 : Math.max(40, Math.ceil(state * coin * 40 / (state * coin * 40 + view) * 80 * 100) / 100),
        "like": like * 20 + view <= 0 ? 0 : Math.floor((coin + favorite) / (like * 20 + view) * 100 * 100) / 100,
        "favorite": favorite * 20 + view <= 0 ? 0 : Math.max(20, Math.ceil((favorite + 2 * coin) / (favorite * 20 + view) * 100) / 100)
    };

    return {
        "fix": {
            "_": 1, "a": 1, "b": 1, "c": 1
        }, "rate": Object.assign(
            rate, { state }
        ), "point": get_point(
            rate, offset
        )
    };
});

calculator.register("calculator-0003", issue => issue > 20241101, (offset, copyright) => {
    const { view, coin, like, favorite } = offset;

    const fix = {
        "a": coin <= 0 ? 0 : (copyright === 1 ? 1 : Math.ceil(Math.max(1, (view + 20 * favorite + 40 * coin + 10 * like) / (200 * coin)) * 100) / 100),
        "b": (view + 20 * favorite) <= 0 ? 0 : Math.ceil(Math.min(1, 3 * Math.max(0, (20 * coin + 10 * like)) / (view + 20 * favorite)) * 100) / 100,
    };

    fix.c = like + favorite <= 0 ? 0 : Math.ceil(Math.min(1, (like + favorite + 20 * coin * fix.a) / (2 * like + 2 * favorite)) * 100) / 100;
    fix._ = Math.round(fix.b * fix.c * 100) / 100;

    const rate = {
        "view": view <= 0 ? 0 : Math.max(Math.ceil(Math.min(Math.max((fix.a * coin + favorite), 0) * 20 / view, 1) * 100) / 100, 0),
        "coin": fix.a * coin * 40 + view <= 0 ? 0 : Math.max(Math.ceil(Math.min((fix.a * coin * 40) / (fix.a * coin * 40 + view) * 80, 40) * 100) / 100, 0),
        "like": like <= 0 ? 0 : Math.max(Math.floor(Math.min(5, Math.max(fix.a * coin + favorite, 0) / (like * 20 + view) * 100) * 100) / 100, 0),
        "favorite": favorite <= 0 ? 0 : Math.max(Math.ceil(Math.min((favorite + 2 * fix.a * coin) * 10 / (favorite * 20 + view) * 40, 20) * 100) / 100, 0)
    };

    const point = {
        "view": view * rate.view,
        "coin": coin * rate.coin,
        "like": like * rate.like,
        "favorite": favorite * rate.favorite
    };

    point._ = Math.floor(Math.round(point.view + point.like + point.coin + point.favorite) * fix.b * fix.c);

    return {
        fix, rate, point
    };
});

export default calculator;