export const variable = {
    "magic": {
        "arr": [0, 1, 2, 9, 7, 5, 6, 4, 8, 3, 10, 11],
        "str": 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'
    },
    
    "table": {
        1: 44, 2: 45, 3: 11, 4: 26, 5: 14, 6: 39, 7: 17,
        8: 29, 9: 52,

        F: 0, c: 1, w: 2, A: 3, P: 4, N: 5, K: 6, T: 7,
        M: 8, u: 9,

        g: 10, G: 12, V: 13,
        L: 15, j: 16, E: 18, J: 19, n: 20, H: 21,
        p: 22, W: 23, s: 24, x: 25, t: 27, b: 28,
        h: 30, a: 31, Y: 32, e: 33, v: 34, i: 35,
        q: 36, B: 37, z: 38, r: 40, k: 41, C: 42,
        y: 43, m: 46, U: 47, S: 48, D: 49, Q: 50,
        X: 51, R: 53, d: 54, o: 55, Z: 56, f: 57
    },

    "encrypt": [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ]
};

export const constant = {
    "LEN": 12,
    "MAX": (1n << 51n),
    "XOR": 23442827791579n,
    "BASE": 58n,
    "MASK": 2251799813685247n
};

export const convert = {
    /**
     * 将视频的识别码转换成第一代识别码
     * 
     * @param {string} vid 需要转换的识别码
     * @param {boolean} prefix 是否自动添加前缀
     * @param {boolean} demote 是否自动降级为数字
     * @param {boolean} overflow 是否允许溢出
     * @returns {string} 转换成的第一代识别码
     */
    vid_to_avid(vid, prefix = true, demote = false, overflow = false) {
        if (typeof vid === "string") {
            if (vid.toUpperCase().startsWith("BV")) {
                return this.bvid_to_avid(
                    vid, prefix, demote, overflow
                );
            }

            if (vid.toLowerCase().startsWith("av")) {
                vid = vid.slice(2).trim();
            }

            if (isFinite(vid) && !vid.includes(".")) {
                vid = BigInt(vid.trim());
            }
        }

        if (demote && typeof vid === "bigint") {
            const max = Number.MAX_SAFE_INTEGER;

            if (vid <= BigInt(max)) {
                return Number(vid);
            }
        }

        return vid;
    },

    /**
     * 将视频的识别码转换成第一代识别码
     * 
     * @param {string} vid 需要转换的识别码
     * @param {boolean} prefix 是否自动添加前缀
     * @returns {string} 转换成的第一代识别码
     */
    vid_to_bvid(vid, prefix = true) {
        const avid = this.vid_to_avid(
            vid, prefix, false, false, false
        );

        return this.avid_to_bvid(avid, prefix);
    },

    /**
     * 将视频的第一代识别码转换成第二代识别码
     * 
     * @param {bigint} avid 需要转换的第一代识别码的整数部分
     * @param {boolean} prefix 是否自动添加前缀
     * @returns {string} 转换成的第二代识别码
     */
    avid_to_bvid(avid, prefix = true) {
        const magic = variable.magic;

        const { BASE, XOR, LEN, MAX } = constant;

        if (typeof avid !== "string") {
            avid = BigInt(avid);
        }

        let rest = LEN - 1;
        let temp = (avid | MAX) ^ XOR;
        let result = { "2": "1" };

        while (temp !== 0n) {
            const index = {
                "left": magic.arr[rest] || rest,
                "right": Number(temp % BASE)
            };
            
            result[index.left] = magic.str[index.right];

            temp /= BASE, rest--;
        }

        const entries = Object.entries(result);

        const chars = entries.sort(
            ([k1], [k2]) => k1 - k2
        ).map(item => item[1]).join("");

        if (!prefix) return chars;

        return "BV" + chars;
    },

    /**
     * 将视频的第二代识别码转换成第一代识别码
     * 
     * @param {string} bvid 需要转换的第二代识别码
     * @param {boolean} prefix 是否自动添加前缀
     * @param {boolean} demote 是否自动降级为数字
     * @param {boolean} overflow 是否允许溢出
     * @returns {bigint} 转换成的第一代识别码
     */
    bvid_to_avid(bvid, prefix = true, demote = false, overflow = false) {
        const { table, magic } = variable;

        const { BASE, XOR, MASK, LEN } = constant;

        let result = 0n;

        for (let i = 3; i < LEN; i++) {
            const number = table[bvid[magic.arr[i]]];

            result = result * BASE + BigInt(number);
        }

        if (!overflow) {
            result &= MASK;
        }

        result ^= XOR;

        if (prefix) {
            return "AV" + result;
        }

        if (demote) {
            const max = Number.MAX_SAFE_INTEGER;

            if (result <= BigInt(max)) {
                return Number(result);
            }
        }

        return result;
    },
};