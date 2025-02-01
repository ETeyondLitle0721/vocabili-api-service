# vocacili-api-service
这是一个主要由 NodeJS 开发的 Vocacili 项目的 API 服务源代码储存仓库

## API文档

### 1. **获取曲目信息 (get_song_info)**

- **URL**: `/get_song_info`
- **方法**: `GET`
- **请求参数**:
    - `target`: 一个数组，包含需要获取信息的曲目的标识符。最大值为200。
  
- **请求示例**:
    ```http
    GET /get_song_info?target=song1,song2,song3
    ```
  
- **响应示例**:
    ```json
    {
        "code": "OK",
        "time": "2025-02-01T12:34:56.789Z",
        "status": "success",
        "message": "一切正常",
        "data": [
            {
                "metadata": {
                    "id": "song1",
                    "name": "Song 1",
                    "type": "Vocaloid",
                    "target": {
                        "vocalist": [
                            {"name": "Vocalist 1", "color": "#ff0000"},
                            {"name": "Vocalist 2", "color": "#00ff00"}
                        ],
                        "producer": ["Producer 1"],
                        "synthesizer": ["Synth 1"]
                    }
                },
                "platform": [
                    {
                        "link": "https://www.bilibili.com/video/xxx",
                        "page": "https://www.bilibili.com/video/xxx",
                        "title": "Song 1 on Bilibili",
                        "publish": "2025-01-01",
                        "uploader": ["Uploader 1"],
                        "duration": 180,
                        "thumbnail": "https://example.com/thumbnail.jpg",
                        "copyright": "Some Copyright"
                    }
                ]
            }
        ]
    }
    ```

---

### 2. **获取排行榜信息 (get_board_info)**

- **URL**: `/get_board_info`
- **方法**: `GET`
- **请求参数**:
    - `board`: 排行榜的名称，支持 `vocaloid-weekly` 和 `vocaloid-daily`。
    - `count`: 要获取的曲目数量，最大为200，默认为50。
    - `index`: 当前页数，默认值为1。
    - `issue`: 排行榜的期数（例如: "2025-01-01"）。

- **请求示例**:
    ```http
    GET /get_board_info?board=vocaloid-weekly&count=10&index=1&issue=2025
    ```

- **响应示例**:
    ```json
    {
        "code": "OK",
        "time": "2025-02-01T12:34:56.789Z",
        "status": "success",
        "message": "一切正常",
        "data": {
            "board": [
                {
                    "rank": {
                        "view": 1,
                        "like": 2,
                        "coin": 3,
                        "board": 4,
                        "favorite": 5
                    },
                    "count": {
                        "view": 1000,
                        "like": 200,
                        "coin": 300,
                        "point": 400,
                        "board": 500,
                        "favorite": 600
                    },
                    "change": {
                        "view": 10,
                        "like": -5,
                        "coin": 3,
                        "favorite": 8
                    },
                    "target": {
                        "metadata": {
                            "id": "song1",
                            "name": "Song 1",
                            "type": "Vocaloid"
                        },
                        "platform": [
                            {
                                "link": "https://www.bilibili.com/video/xxx",
                                "title": "Song 1 on Bilibili"
                            }
                        ]
                    }
                }
            ],
            "metadata": {
                "id": "vocaloid-weekly",
                "name": "Vocaloid Weekly Chart",
                "issue": 2025
            }
        }
    }
    ```

---

### 3. **获取当前排行榜 (get_current_board_info)**

- **URL**: `/get_current_board_info`
- **方法**: `GET`
- **请求参数**:
    - `board`: 排行榜的名称，支持 `vocaloid-weekly` 和 `vocaloid-daily`。
    - `count`: 要获取的曲目数量，最大为200，默认为50。
    - `index`: 当前页数，默认为1。

- **请求示例**:
    ```http
    GET /get_current_board_info?board=vocaloid-weekly&count=10&index=1
    ```

- **响应示例**:
    ```json
    {
        "code": "OK",
        "time": "2025-02-01T12:34:56.789Z",
        "status": "success",
        "message": "一切正常",
        "data": {
            "board": [
                {
                    "rank": {
                        "view": 1,
                        "like": 2,
                        "coin": 3,
                        "board": 4,
                        "favorite": 5
                    },
                    "count": {
                        "view": 1000,
                        "like": 200,
                        "coin": 300,
                        "point": 400,
                        "board": 500,
                        "favorite": 600
                    },
                    "change": {
                        "view": 10,
                        "like": -5,
                        "coin": 3,
                        "favorite": 8
                    },
                    "target": {
                        "metadata": {
                            "id": "song1",
                            "name": "Song 1",
                            "type": "Vocaloid"
                        },
                        "platform": [
                            {
                                "link": "https://www.bilibili.com/video/xxx",
                                "title": "Song 1 on Bilibili"
                            }
                        ]
                    }
                }
            ],
            "metadata": {
                "id": "vocaloid-weekly",
                "name": "Vocaloid Weekly Chart",
                "issue": 2025
            }
        }
    }
    ```

---

### 4. **获取曲目历史统计量 (get_song_count_history_info)**

- **URL**: `/get_song_count_history_info`
- **方法**: `GET`
- **请求参数**:
    - `target`: 曲目ID（最大支持5个）。
    - `count`: 要获取的条目数量，最大为300，默认为300。
    - `index`: 当前页数，默认为1。

- **请求示例**:
    ```http
    GET /get_song_count_history_info?target=song1,song2&count=100&index=1
    ```

- **响应示例**:
    ```json
    {
        "code": "OK",
        "time": "2025-02-01T12:34:56.789Z",
        "status": "success",
        "message": "一切正常",
        "data": [
            {
                "date": "2025-01-01",
                "count": {
                    "view": 500,
                    "like": 100,
                    "coin": 150,
                    "favorite": 200
                }
            }
        ]
    }
    ```

---

### 5. **获取曲目历史排名信息 (get_song_rank_history_info)**

- **URL**: `/get_song_rank_history_info`
- **方法**: `GET`
- **请求参数**:
    - `target`: 曲目ID。
    - `issue`: 期数列表（例如：[2025, 2026]）。
    - `board`: 排行榜名称（如 `vocaloid-weekly`）。
    - `count`: 获取的条目数量，最大为300，默认为50。
    - `index`: 当前页数，默认为1。

- **请求示例**:
    ```http
    GET /get_song_rank_history_info?target=song1&issue=2025&board=vocaloid-weekly&count=50&index=1
    ```

- **响应示例**:
    ```json
    {
        "code": "OK",
        "time": "2025-02-01T12:34:56.789Z",
        "status": "success",
        "message": "一切正常",
        "data": [
            {
                "rank": {
                    "view": 1,
                    "like": 2,
                    "coin": 3,
                    "board": 4,
                    "favorite": 5
                },
                "target": "song1",
                "point": 1000,
                "change": {
                    "view": 10,
                    "like": -5,
                    "coin": 3,
                    "favorite": 8
                },
                "issue": 2025,
                "board": "vocaloid-weekly"
            }
        ]
    }
    ```

### 错误代码说明

- **NOT_FOUND**: 请求的资源不存在。
- **BOARD_NOT_EXISTS**: 请求的排行榜不存在。
- **TARGET_NOT_EXISTS**: 目标参数不存在。
- **NUMBER_NOT_INTEGER**: 传递的参数不是整数。
- **NUMBER_OUT_OF_RANGE**: 传递的数字超出指定的范围。
- **DISALLOW_MULTIPLE_TARGET**: 不允许传递多个目标。
- **COUNT_OUT_OF_RANGE**: 传递的参数数量超出范围。