import axios from "axios";
import category from "./define/category.json" with { "type": "json" };

const creator = (domain) => {
    return axios.create({
        "baseURL": `https://${domain}/`
    });
};

export const instance = {
    "api": creator("api.bilibili.com"),
};

export const video = {
    /**
     * 通过视频的 AV 号列表批量获取视频数据
     * 
     * @param {number[]} id_list 需要获取的视频的 AV 号列表
     * @param {boolean} auto_flat 是否自动扁平化
     * @returns 获取到的信息
     */
    async batch(id_list, auto_flat = false) {
        if (!Array.isArray(id_list)) {
            id_list = [ id_list ];
        }

        const target = id_list.map(id => id + ":2").join(",");

        const response = await instance.api.get(
            "/medialist/gateway/base/resource/infos", {
                "params": { "resources": target }
            }
        );

        const data = {
            "origin": response.data,
            "result": response.data.data
        };

        if (!data.result) {
            const error = data.origin;

            return {
                "status": "failure",
                "level": "fatal",
                "reason": {
                    "10003": "target-manuscript-does-not-exist",
                    "72010017": "parameter-error"
                } [ error.code ] || "unknown"
            };
        }

        const result = [];

        for (let index = 0; index < data.result.length; index++) {
            const video = data.result[index];

            const { cnt_info: counter, dimension } = video;

            const info = {
                "vid": {
                    "first": video.id,
                    "second": video.bvid
                },
                "video": {
                    "type": video.type,
                    "title": video.title,
                    "counter": {
                        "view": counter.play,
                        "coin": counter.coin,
                        "like": counter.thumb_up,
                        "share": counter.share,
                        "reply": counter.reply,
                        "danmaku": counter.danmaku,
                        "favorite": counter.collect
                    },
                    "datetime": {
                        "create": new Date(video.ctime * 1000),
                        "publish": new Date(video.pubtime * 1000)
                    },
                    "duration": video.duration,
                    "category": {
                        "first": {
                            "id": video.tid,
                            "name": category.old[video.tid],
                        }
                    },
                    "copyright": video.copyright,
                    "restraint": {
                        "coin": video.coin.max_num,
                    },
                    "thumbnail": video.cover,
                    "dimension": {
                        "width": dimension.width,
                        "height": dimension.height
                    },
                    "identifier": {
                        "first": video.id,
                        "second": video.bvid
                    },
                    "description": video.intro,
                },
                "uploader": {
                    "vip": {
                        "type": {
                            "vip": video.upper.vip_type,
                            "pay": video.upper.vip_pay_type,
                        },
                        "statue": video.upper.vip_statue,
                        "datetime": {
                            "expire": new Date(video.upper.vip_due_date)
                        }
                    },
                    "avatar": video.upper.face,
                    "nickname": video.upper.name,
                    "identifier": {
                        "first": video.upper.mid,
                    }
                }
            };

            if (info.video.title === "已失效视频") {
                if (!video.duration) {
                    info.video.title = null;
                }
            }

            result.push(info);
        }

        if (auto_flat) {
            if (result.length === 1) {
                return {
                    "status": "success",
                    "result": result[0]
                };
            }
        }

        return {
            "status": "success",
            "result": result
        };
    },
};