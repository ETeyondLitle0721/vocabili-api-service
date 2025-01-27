/**
 * @typedef ServiceProvidePointConfig
 * @property {("http"|"https")} protocol 通讯协议
 * @property {string} host 主机名
 * @property {number} port 端口号
 * @property {string} point 接入点
 * 
 * @typedef RequesterResponse
 * @property {string} result 原始原始结果
 */

export class ServiceRequester {
    /**
     * 实例化 ServiceRequester 对象
     * 
     * @param {ServiceProvidePointConfig} config 服务提供点信息
     * @returns {ServiceRequester} 实例化的 ServiceRequester 对象
     */
    constructor(config = {}) {
        this.config = config;

        if (this.config.point.endsWith("/")) {
            this.config.point = this.config.point.slice(
                0, this.config.point.length - 1
            );
        }
    }

    /**
     * 实现发送请求
     * 
     * @param {ServiceProvidePointConfig} config 服务提供点信息
     * @param {string} path 需要请求的路径
     * @param {Object<string, (number|string)>} param 携带参数
     * @param {("get"|"post")} method 使用请求方法
     * @param {Object<string, (number|string)>} headers 请求头
     * @returns {Promise<RequesterResponse>} 可以取得 RequesterResponse 对象的 Promise 实例化对象
     */
    async requester(config, path, param = {}, method = "get", headers = {}) {
        let url = `${config.protocol}://${config.host}:${config.port}${config.point}${path}`;

        method = method.toLowerCase();

        const options = {
            "method": method.toUpperCase(),
            "headers": Object.assign(headers, {
                "Content-Type": "application/json"
            })
        };

        if (method === "post" && Object.keys(param).length > 0) {
            options.body = JSON.stringify(param);
        } else if (method === "get" && Object.keys(param).length > 0) {
            const query = new URLSearchParams(param).toString();

            url += `?${query}`;
        }

        try {
            const response = await fetch(url, options);
    
            if (!response.ok) {
                throw new Error(`HTTP状态码异常: ${response.status}`);
            }
    
            const result = await response.text();

            return { result };
        } catch (error) {
            console.error("请求发生错误:", error);

            throw error;
        }
    }

    /**
     * 获取最新的排行榜
     * 
     * @param {string[]} list 需要获取信息的曲目的识别码列表（不超过 5000 个）
     * @returns {Promise<>} 获取到的曲目数据
     */
    async get_song_info(list = []) {
        
    }

    /**
     * 获取最新的排行榜
     * 
     * @param {("vocaloid-weekly"|"voclaoid-daily")} board 需要获取的排行榜
     * @param {number} count 要获取多少个（不超过 500 个）
     * @param {number} page 当前的页数
     * @returns {Promise<BoardInfo>} 获取到的排行榜信息
     */
    async get_current_board_info(board = "vocaoid-weekly", count = 50, page = 1) {
        const response = JSON.parse(
            (await this.requester(
                this.config, "/get_board/" + board + "/top" + count, {
                    "page": page
                }
            )).result
        ).data;

        console.log(response)
    }
}

export default ServiceRequester;