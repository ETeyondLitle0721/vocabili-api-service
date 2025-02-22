## API 文档

### 1. 获取曲目信息

**路由地址**: `/get_info/song`  
**请求方法**: GET / POST  
**描述**: 根据曲目ID列表获取曲目的详细信息。

**请求参数**:

- `target` (string[]): 曲目ID列表，多个ID用逗号分隔。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": [
    {
      "metadata": {
        "id": "song_id_1",
        "name": "曲目名称",
        "type": "曲目类型",
        "target": {
          "vocalist": [
            {
              "id": "vocalist_id_1",
              "name": "歌手名称",
              "color": "颜色代码"
            }
          ],
          "producer": [
            {
              "id": "producer_id_1",
              "name": "制作人名称"
            }
          ],
          "synthesizer": [
            {
              "id": "synthesizer_id_1",
              "name": "合成器名称"
            }
          ]
        }
      },
      "platform": [
        {
          "id": "platform_id_1",
          "link": "https://b23.tv/...",
          "publish": "发布时间",
          "page": "页面信息",
          "title": "标题",
          "uploader": [
            {
              "id": "uploader_id_1",
              "name": "上传者名称"
            }
          ],
          "duration": "时长",
          "thumbnail": "https://i0.hdslb.com/bfs/archive/...",
          "copyright": "版权信息"
        }
      ]
    }
  ]
}
```

**示例请求**:

```
GET /get_info/song?target=song_id_1,song_id_2
```

---

### 2. 获取曲目列表（通过关联信息）

**路由地址**: `/get_list/song/by_:type`  
**请求方法**: GET / POST  
**描述**: 根据关联类型（如上传者、歌手、制作人等）获取曲目列表。

**地址参数**:

- `type` (string): 关联类型，可选值为 `uploader`, `vocalist`, `producer`, `synthesizer`。

**请求参数**:

- `target` (string): 关联目标的ID。
- `count` (number): 每页返回的曲目数量，默认为50。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "total": 100,
    "result": [
      {
        "metadata": {
          "id": "song_id_1",
          "name": "曲目名称",
          "type": "曲目类型",
          "target": {
            "vocalist": [
              {
                "id": "vocalist_id_1",
                "name": "歌手名称",
                "color": "颜色代码"
              }
            ],
            "producer": [
              {
                "id": "producer_id_1",
                "name": "制作人名称"
              }
            ],
            "synthesizer": [
              {
                "id": "synthesizer_id_1",
                "name": "合成器名称"
              }
            ]
          }
        },
        "platform": [
          {
            "id": "platform_id_1",
            "link": "https://b23.tv/...",
            "publish": "发布时间",
            "page": "页面信息",
            "title": "标题",
            "uploader": [
              {
                "id": "uploader_id_1",
                "name": "上传者名称"
              }
            ],
            "duration": "时长",
            "thumbnail": "https://i0.hdslb.com/bfs/archive/...",
            "copyright": "版权信息"
          }
        ]
      }
    ]
  }
}
```

**示例请求**:

```
GET /get_list/song/by_vocalist?target=vocalist_id_1&count=10&index=1
```

---

### 3. 获取目标列表

**路由地址**: `/get_list/:type`  
**请求方法**: GET / POST  
**描述**: 获取指定类型的目标列表（如曲目、榜单、上传者、歌手等）。

**地址参数**:

- `type` (string): 目标类型，可选值为 `song`, `board`, `uploader`, `vocalist`, `producer`, `synthesizer`。

**请求参数**:

- `count` (number): 每页返回的目标数量，默认为20。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "total": 100,
    "result": [
      {
        "id": "target_id_1",
        "name": "目标名称",
        "color": "颜色代码" // 仅当 type 为 vocalist 时存在
      }
    ]
  }
}
```

**示例请求**:

```
GET /get_list/vocalist?count=10&index=1
```

---

### 4. 获取榜单信息

**路由地址**: `/get_info/board`  
**请求方法**: GET / POST  
**描述**: 获取指定榜单的详细信息。

**请求参数**:

- `board` (string): 榜单ID。
- `issue` (number[]): 期数列表。
- `count` (number): 每页返回的曲目数量，默认为50。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
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
        "count": 100,
        "change": {
          "view": 1,
          "like": 2,
          "coin": 3,
          "favorite": 4
        },
        "target": {
          "metadata": {
            "id": "song_id_1",
            "name": "曲目名称",
            "type": "曲目类型"
          },
          "platform": {
            "id": "platform_id_1",
            "link": "https://b23.tv/...",
            "publish": "发布时间",
            "page": "页面信息",
            "title": "标题",
            "uploader": [
              {
                "id": "uploader_id_1",
                "name": "上传者名称"
              }
            ],
            "duration": "时长",
            "thumbnail": "https://i0.hdslb.com/bfs/archive/...",
            "copyright": "版权信息"
          }
        }
      }
    ],
    "metadata": {
      "id": "board_id_1",
      "name": "榜单名称",
      "date": "2023-10-01",
      "issue": 1,
      "count": 100
    }
  }
}
```

**示例请求**:

```
GET /get_info/board?board=vocaoid-weekly-main&issue=1&count=10&index=1
```

---

### 5. 获取最新榜单信息

**路由地址**: `/get_info/board/_current`  
**请求方法**: GET / POST  
**描述**: 获取指定榜单的最新一期信息。

**请求参数**:

- `board` (string): 榜单ID。
- `count` (number): 每页返回的曲目数量，默认为50。
- `index` (number): 页码，默认为1。

**响应数据**:
与 `/get_info/board` 相同。

**示例请求**:

```
GET /get_info/board/_current?board=vocaoid-weekly-main&count=10&index=1
```

---

### 6. 获取曲目历史排名信息

**路由地址**: `/get_history/song/rank`  
**请求方法**: GET / POST  
**描述**: 获取曲目在指定榜单中的历史排名信息。

**请求参数**:

- `target` (string): 曲目ID。
- `issue` (number[]): 期数列表。
- `board` (string[]): 榜单ID列表。
- `count` (number): 每页返回的记录数量，默认为50。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": [
    {
      "rank": {
        "view": 1,
        "like": 2,
        "board": 3,
        "coin": 4,
        "favorite": 5
      },
      "target": "song_id_1",
      "point": 100,
      "change": {
        "view": 1,
        "like": 2,
        "coin": 3,
        "favorite": 4
      },
      "issue": 1,
      "board": "vocaoid-weekly-main"
    }
  ]
}
```

**示例请求**:

```
GET /get_history/song/rank?target=song_id_1&issue=1&board=vocaoid-weekly-main&count=10&index=1
```

---

### 7. 获取曲目历史统计量信息

**路由地址**: `/get_history/platform/count`  
**请求方法**: GET / POST  
**描述**: 获取曲目在平台上的历史统计量信息（如播放量、点赞数等）。

**请求参数**:

- `target` (string): 曲目ID。
- `count` (number): 每页返回的记录数量，默认为300。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "total": 100,
    "result": [
      {
        "date": "2023-10-01",
        "count": {
          "view": 1000,
          "like": 500,
          "coin": 200,
          "favorite": 100
        }
      }
    ]
  }
}
```

**示例请求**:

```
GET /get_history/platform/count?target=song_id_1&count=10&index=1
```

---

### 8. 通过曲目名称搜索曲目

**路由地址**: `/search/song/by_name`  
**请求方法**: GET / POST  
**描述**: 根据曲目名称搜索曲目。

**请求参数**:

- `target` (string): 曲目名称。
- `count` (number): 每页返回的曲目数量，默认为25。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "total": 100,
    "result": [
      {
        "metadata": {
          "id": "song_id_1",
          "name": "曲目名称",
          "type": "曲目类型"
        },
        "platform": [
          {
            "id": "platform_id_1",
            "link": "https://b23.tv/...",
            "publish": "发布时间",
            "page": "页面信息",
            "title": "标题",
            "uploader": [
              {
                "id": "uploader_id_1",
                "name": "上传者名称"
              }
            ],
            "duration": "时长",
            "thumbnail": "https://i0.hdslb.com/bfs/archive/...",
            "copyright": "版权信息"
          }
        ]
      }
    ]
  }
}
```

**示例请求**:

```
GET /search/song/by_name?target=曲目名称&count=10&index=1
```

---

### 9. 通过平台标题搜索曲目

**路由地址**: `/search/song/by_platform`  
**请求方法**: GET / POST  
**描述**: 根据平台标题或BVID搜索曲目。

**请求参数**:

- `title` (string): 平台标题。
- `bvid` (string): 平台BVID。
- `count` (number): 每页返回的曲目数量，默认为25。
- `index` (number): 页码，默认为1。

**响应数据**:
与 `/search/song/by_name` 相同。

**示例请求**:

```
GET /search/song/by_platform?title=标题&bvid=BVID&count=10&index=1
```

---

### 10. 通过名称搜索目标

**路由地址**: `/search/:type/by_name`  
**请求方法**: GET / POST  
**描述**: 根据名称搜索指定类型的目标（如上传者、歌手、制作人等）。

**地址参数**:

- `type` (string): 目标类型，可选值为 `uploader`, `vocalist`, `producer`, `synthesizer`。

**请求参数**:

- `target` (string): 目标名称。
- `count` (number): 每页返回的目标数量，默认为25。
- `index` (number): 页码，默认为1。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "total": 100,
    "result": [
      {
        "id": "target_id_1",
        "name": "目标名称",
        "color": "颜色代码" // 仅当 type 为 vocalist 时存在
      }
    ]
  }
}
```

**示例请求**:

```
GET /search/vocalist/by_name?target=歌手名称&count=10&index=1
```

---

### 11. 获取榜单元数据信息

**路由地址**: `/get_info/metadata/board`  
**请求方法**: GET / POST  
**描述**: 获取指定榜单的元数据信息。

**请求参数**:

- `target` (string): 榜单ID。
- `set-cache` (number): 缓存时间，默认为0。

**响应数据**:

```json
{
  "code": "OK",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "success",
  "data": {
    "id": "board_id_1",
    "name": "榜单名称",
    "catalog": [
      {
        "issue": 1,
        "date": "2023-10-01",
        "count": 100
      }
    ]
  }
}
```

**示例请求**:

```
GET /get_info/metadata/board?target=vocaoid-weekly-main&set-cache=3600
```

---

### 12. 404 错误处理

**路由地址**: `*`  
**请求方法**: 所有方法  
**描述**: 当请求的资源不存在时返回404错误。

**响应数据**:

```json
{
  "code": "NOT_FOUND",
  "time": "2023-10-01T12:00:00.000Z",
  "status": "failed",
  "target": "/invalid_path",
  "message": "目标资源不存在。"
}
```

## 响应代码

### 1. 成功响应

| 代码       | 含义                     | 描述                                                                 |
|------------|--------------------------|----------------------------------------------------------------------|
| `OK`       | 请求成功                 | 请求已成功处理，返回了预期的数据。                                   |

---

### 2. 客户端错误

| 代码                       | 含义                                     | 描述                                                                 |
|----------------------------|------------------------------------------|----------------------------------------------------------------------|
| `TARGET_NOT_EXISTS`        | 目标参数不存在                           | 请求中缺少必需的参数。                                               |
| `TARGET_NOT_NUMBER`        | 目标参数不是数字                         | 请求中的参数不是合法的数字。                                         |
| `NUMBER_NOT_INTEGER`       | 目标参数不是整数                         | 请求中的参数不是整数。                                               |
| `NUMBER_OUT_OF_RANGE`      | 目标参数超出范围                         | 请求中的参数超出了允许的范围。                                       |
| `DISALLOW_MULTIPLE_TARGET` | 不允许多目标表达式                       | 请求中的参数不允许传递多个值。                                       |
| `COUNT_OUT_OF_RANGE`       | 参数数量超出范围                         | 请求中传递的参数数量超出了允许的最大值。                             |
| `PARAMETER_VALUE_ILLEGAL`  | 参数值非法                               | 请求中的参数值不符合预期的格式或类型。                               |
| `BOARD_NOT_EXISTS`         | 目标榜单不存在                           | 请求中指定的榜单不存在。                                             |
| `ISSUE_NOT_EXISTS`         | 目标刊目不存在                           | 请求中指定的榜单期数不存在。                                         |
| `NO_ENTRY_EXISTS`          | 没有找到有效条目                         | 请求的目标资源没有任何有效条目。                                     |
| `NOT_FOUND_VALID_VALUE`    | 没有找到有效值                           | 请求中缺少有效的参数值。                                             |

---

### 3. 服务器错误

| 代码                       | 含义                                     | 描述                                                                 |
|----------------------------|------------------------------------------|----------------------------------------------------------------------|
| `NOT_IMPLEMENTED_YET`      | 功能尚未实现                             | 请求的功能尚未实现。                                                 |
| `INTERNAL_SERVER_ERROR`    | 服务器内部错误                           | 服务器在处理请求时遇到未预期的错误。                                 |

---

### 4. 通用错误

| 代码                       | 含义                                     | 描述                                                                 |
|----------------------------|------------------------------------------|----------------------------------------------------------------------|
| `NOT_FOUND`                | 目标资源不存在                           | 请求的资源不存在。                                                   |

## 调试模式添加的信息

```json
{
    "debug": {
        "timing": {
            "receive": "2023-10-01T12:00:00.000Z", // 请求接收时间
            "current": "2023-10-01T12:00:01.000Z", // 当前时间
            "consume": "100ms" // 请求处理耗时
        },
        "request": {
            "params": { // 请求参数
                "target": "song_id_1",
                "count": 10
            },
            "headers": { // 请求头信息
                "user-agent": "Mozilla/5.0",
                "accept": "application/json"
            },
            "address": "127.0.0.1", // 客户端IP地址
            "resource": "/get_info/song" // 请求资源路径
        }
    }
}
```
