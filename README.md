# API 文档

## 1. 获取曲目信息

**路由地址**: `/info/song`  
**请求方法**: GET / POST  
**描述**: 根据曲目ID列表获取曲目的详细信息。

**请求参数**:

- `target` (string[]): 曲目ID列表，多个ID用逗号分隔。

**示例请求**:

```http
GET /info/song?target=song_id_1,song_id_2
```

---

## 2. 获取曲目列表（通过关联信息）

**路由地址**: `/list/song/by_:type`  
**请求方法**: GET / POST  
**描述**: 根据关联类型（如上传者、歌手、制作人等）获取曲目列表。

**地址参数**:

- `type` (string): 关联类型，可选值为 `uploader`, `vocalist`, `producer`, `synthesizer`。

**请求参数**:

- `target` (string): 关联目标的ID。
- `count` (number): 每页返回的曲目数量，默认为50。
- `index` (number): 页码，默认为1。

**示例请求**:

```http
GET /list/song/by_vocalist?target=vocalist_id_1&count=10&index=1
```

---

## 3. 获取目标列表

**路由地址**: `/list/:type`  
**请求方法**: GET / POST  
**描述**: 获取指定类型的目标列表（如曲目、榜单、上传者、歌手等）。

**地址参数**:

- `type` (string): 目标类型，可选值为 `song`, `board`, `uploader`, `vocalist`, `producer`, `synthesizer`。

**请求参数**:

- `count` (number): 每页返回的目标数量，默认为20。
- `index` (number): 页码，默认为1。

**示例请求**:

```http
GET /list/vocalist?count=10&index=1
```

---

## 4. 获取榜单信息

**路由地址**: `/info/board`  
**请求方法**: GET / POST  
**描述**: 获取指定榜单的详细信息。

**请求参数**:

- `board` (string): 榜单ID。
- `issue` (number[]): 期数列表。
- `count` (number): 每页返回的曲目数量，默认为50。
- `index` (number): 页码，默认为1。
- `part` (string): 子刊名称。

**示例请求**:

```http
GET /info/board?board=vocaloid-weekly&part=main&issue=1&count=10&index=1
```

---

## 5. 获取最新榜单信息

**路由地址**: `/info/board/_latest`  
**请求方法**: GET / POST  
**描述**: 获取指定榜单的最新一期信息。

**请求参数**:

- `board` (string): 榜单ID。
- `count` (number): 每页返回的曲目数量，默认为50。
- `index` (number): 页码，默认为1。
- `part` (string): 子刊名称。

**示例请求**:

```http
GET /info/board/_latest?board=vocaloid-weekly&count=10&index=1&part=new
```

---

## 6. 获取曲目历史排名信息

**路由地址**: `/history/song/rank`  
**请求方法**: GET / POST  
**描述**: 获取曲目在指定榜单中的历史排名信息。

**请求参数**:

- `target` (string): 曲目ID。
- `sort` (string): 获取数据的时候获取顺序，默认为oldest。
- `part` (string): 需要获取的子刊名称，默认为main。
- `issue` (number[]): 期数列表。
- `board` (string[]): 榜单ID列表。
- `count` (number): 每页返回的记录数量，默认为50。
- `index` (number): 页码，默认为1。

**示例请求**:

```http
GET /history/song/rank?target=song_id_1&issue=1&board=vocaloid-weekly&part=main&count=10&index=1&sort=oldest
```

---

## 7. 获取曲目历史统计量信息

**路由地址**: `/history/platform/count`  
**请求方法**: GET / POST  
**描述**: 获取曲目在平台上的历史统计量信息（如播放量、点赞数等）。

**请求参数**:

- `target` (string): 曲目ID。
- `sort` (string): 获取数据的时候获取顺序，默认为oldest。
- `count` (number): 每页返回的记录数量，默认为300。
- `index` (number): 页码，默认为1。

**示例请求**:

```http
GET /history/platform/count?target=song_id_1&count=10&index=1&sort=oldest
```

---

## 8. 通过曲目名称搜索曲目

**路由地址**: `/search/song/by_name`  
**请求方法**: GET / POST  
**描述**: 根据曲目名称搜索曲目。

**请求参数**:

- `target` (string): 曲目名称。
- `count` (number): 每页返回的曲目数量，默认为25。
- `index` (number): 页码，默认为1。
- `threshold` (number): 匹配阈值，范围 [0, 1]，默认为 0.2。

**示例请求**:

```http
GET /search/song/by_name?target=曲目名称&count=10&index=1
```

---

## 9. 通过标题搜索曲目

**路由地址**: `/search/song/by_title`  
**请求方法**: GET / POST  
**描述**: 根据视频标题。

**请求参数**:

- `target` (string): 视频标题。
- `count` (number): 每页返回的曲目数量，默认为25。
- `index` (number): 页码，默认为1。
- `threshold` (number): 匹配阈值，范围 [0, 1]，默认为 0.2。

**示例请求**:

```http
GET /search/song/by_title?target=标题&count=10&index=1
```

---

## 10. 通过过滤器搜索曲目

**路由地址**: `/search/song/by_filter`  
**请求方法**: GET / POST  
**描述**: 根据过滤器参数。

**请求参数**:

- `keywords` (string[]): 曲目名称的关键词列表。
- `vocalist` (string[]): 曲目的演唱者信息匹配条件。
- `uploader` (string[]): 曲目的上传者信息匹配条件。
- `synthesizer` (string[]): 曲目的合成器信息匹配条件。
- `producer` (string[]): 曲目的创作者信息匹配条件。
- `publish_end` (string): 曲目的上传日期上限（ISO 8601 格式的时间字符串）。
- `publish_start` (string): 曲目的上传日期下限（ISO 8601 格式的时间字符串）。
- `type` (string): 曲目类型。
- `copyright` (string): 版权状态。
- `sort` (string): 结果的排序依据。
- `order` (string): 结果的排序方法。
- `count` (number): 每页返回的曲目数量，默认为25。
- `index` (number): 页码，默认为1。

**示例请求**:

```http
GET /search/song/by_filter?keywords=你好,乌托邦&count=10&index=1
```

---

## 11. 通过名称搜索目标

**路由地址**: `/search/:type/by_name`  
**请求方法**: GET / POST  
**描述**: 根据名称搜索指定类型的目标（如上传者、歌手、制作人等）。

**地址参数**:

- `type` (string): 目标类型，可选值为 `uploader`, `vocalist`, `producer`, `synthesizer`。

**请求参数**:

- `target` (string): 目标名称。
- `count` (number): 每页返回的目标数量，默认为25。
- `index` (number): 页码，默认为1。

**示例请求**:

```http
GET /search/vocalist/by_name?target=音&count=10&index=1
```

---

## 12. 获取榜单元数据信息

**路由地址**: `/metadata/board`  
**请求方法**: GET / POST  
**描述**: 获取指定榜单的元数据信息。

**请求参数**:

- `target` (string): 榜单ID。

**示例请求**:

```http
GET /metadata/board?target=vocaloid-weekly&part=new
```

---

## 13. 获取刊物元数据信息

**路由地址**: `/metadata/board/issue`  
**请求方法**: GET / POST  
**描述**: 获取指定刊物的元数据信息。

**请求参数**:

- `target` (string): 榜单ID。
- `issue` (number): 刊物期数。

**示例请求**:

```http
GET /metadata/board/issue?target=vocaloid-weekly&issue=114
```

---

## 14. 获取子刊元数据信息

**路由地址**: `/metadata/board/issue/part`  
**请求方法**: GET / POST  
**描述**: 获取指定子刊的元数据信息。

**请求参数**:

- `target` (string): 榜单ID。
- `issue` (number): 刊物期数。
- `part` (string): 子刊名称。

**示例请求**:

```http
GET /metadata/board/part?target=vocaloid-weekly&issue=114&part=new
```

---

## 15. 检查榜单的存在性

**路由地址**: `/check/exist/board`  
**请求方法**: GET / POST  
**描述**: 检查指定榜单得存在性。

**请求参数**:

- `target` (string): 榜单ID。

**示例请求**:

```http
GET /check/exist/board?board=vocaloid-weekly
```

---

## 16. 检查刊物的存在性

**路由地址**: `/check/exist/board/issue`  
**请求方法**: GET / POST  
**描述**: 检查指定刊物的存在性。

**请求参数**:

- `target` (string): 榜单ID。
- `issue` (number): 刊物期数。

**示例请求**:

```http
GET /check/exist/board/issue?board=vocaloid-weekly&issue=114
```

---

## 17. 检查子刊的存在性

**路由地址**: `/check/exist/board/issue/part`  
**请求方法**: GET / POST  
**描述**: 检查指定子刊的存在性。

**请求参数**:

- `target` (string): 榜单ID。
- `issue` (number): 刊物期数。
- `part` (string): 子刊名称。

**示例请求**:

```http
GET /check/exist/board/part?board=vocaloid-weekly&issue=114&part=new
```

---

## 18. 404 错误处理

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
| `PART_NOT_EXISTS`         | 目标刊目不存在指定子刊                           | 请求中指定的子刊不存在。                                         |
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
            "resource": "/info/song" // 请求资源路径
        }
    }
}
```

## 命令列表

### init:database
```bash
npm run init:database
```

- **功能**：初始化数据库表、索引结构

---

### start:service

```bash
npm run start:service
```

- **参数**：
  - `target`：目标服务的识别码（当前仅支持 `interface`）

- **功能**：启动本地服务
- **数据源**：读取 `source/define/service.json`

---

### insert:database

```bash
npm run insert:database
```

- **功能**：执行数据库全量插入
- **数据源**：读取 `source/script/database/define/insert.json`

---

### clean:database

```bash
npm run clean:database
```

- **功能**：清理数据库中无引用的实体

---

### locate:database

```bash
npm run locate:database mode=mark target=<ID>
```

- **功能**：通过识别码定位目标
- **参数**：
  - `mode`：定位模式（当前仅支持 `mark`）
  - `target`：目标识别码（示例：`Synthesizer:M7DTLPKTNs`）
- **交互特性**：需按回车键进行下一数据查找

---

### update:database

```bash
# 常规模式
npm run update:database mode=<daily|weekly|yearly> [new=<path>] [main=<path>] [total=<path>]

# 特刊模式
npm run update:database mode=special file=<path> date=<YYYY-MM-DD> issue=<num> name="<name>"
```

- **功能**：更新数据库信息
- **参数说明**：
  - `mode`：插入模式（`daily`/`weekly`/`yearly`/`special`）
  - 常规模式：
    - `new`/`main`/`total`：xlsx 文件路径（可多路径逗号分隔）
  - 特刊模式：
    - `file`：特刊文件路径
    - `date`：发刊日期
    - `issue`：期数
    - `name`：特刊名称（含空格需加引号）
- **文件特性**：
  - 支持相对路径（以项目根目录为基准）
  - 特刊文件多 sheet 将被处理为不同 part

---

### catalog:database

```bash
npm run catalog:database
```

- **功能**：更新数据库 catalog 信息至定义文件

---

## 通用参数

所有命令支持 `field` 参数：

```bash
--field=<database_name>
```

- **作用**：指定操作数据库（默认使用 `default`）
- **配置位置**：`config.json` 的 `database` 字段

## 示例集合

```bash
# 定位操作
npm run locate:database mode=mark target=Synthesizer:M7DTLPKTNs

# 周榜更新
npm run update:database mode=weekly new=./新曲2025-03-15.xlsx main=./2025-03-15.xlsx

# 特刊更新
npm run update:database mode=special file=./热异常.xlsx date=2024-07-28 name="熱異常 排行榜"
```
