### API 接口文档

---

## 路由列表

---

### 1. 获取曲目信息

**路径**: `/get_info/song`  
**方法**: GET/POST  
**参数**:

- `target` (必填): 曲目ID数组，最多200个

**错误码**:

- `TARGET_NOT_EXISTS`: 未传递target参数
- `TARGET_COUNT_EXCEEDED`: 超过200个ID

---

### 2. 按关联类型获取曲目列表

**路径**: `/get_list/song/by_:type`  
**方法**: GET/POST  
**参数**:

- `type` (路径参数): 关联类型 (`vocalist`/`producer`/`synthesizer`)
- `target` (必填): 关联目标ID
- `count` (默认50): 每页数量 (1-50)
- `index` (默认1): 页码 (1-131072)

**错误码**:

- `PARAMETER_VALUE_ILLEGAL`: 无效的type参数
- `TARGET_NOT_EXISTS`: 未传递target参数

---

### 3. 获取目标列表

**路径**: `/get_list/:type`  
**方法**: GET/POST  
**参数**:

- `type` (路径参数): 目标类型 (`song`/`board`/`vocalist`/`producer`/`synthesizer`)
- `count` (默认50): 每页数量 (1-50)
- `index` (默认1): 页码 (1-131072)

**错误码**:

- `PARAMETER_VALUE_ILLEGAL`: 无效的type参数

---

### 4. 获取榜单数据

**路径**: `/get_info/board`  
**方法**: GET/POST  
**参数**:

- `board` (必填): 榜单ID
- `issue` (必填): 期号
- `count` (默认50): 每页数量 (1-200)
- `index` (默认1): 页码 (1-131072)

**响应示例**:

**错误码**:

- `BOARD_NOT_EXISTS`: 榜单不存在
- `ISSUE_NOT_EXISTS`: 期号不存在

---

### 5. 获取最新榜单

**路径**: `/get_info/board/_current`  
**方法**: GET/POST  
**参数**: 同`/get_info/board` (无需issue)

**错误码**:

- `NO_ENTRY_EXISTS`: 榜单无数据

---

### 6. 获取曲目历史统计

**路径**: `/get_history/song/count`  
**方法**: GET/POST  
**参数**:

- `target` (必填): 曲目ID (最多5个)
- `count` (默认300): 数据量 (-1表示全部)
- `index` (默认1): 页码

---

### 7. 搜索曲目

**路径**: `/search/song_list/by_platform`  
**方法**: GET/POST  
**参数**:

- `title`: 视频标题关键词
- `bvid`: BVID片段
- `count` (默认25): 每页数量
- `index` (默认1): 页码

**错误码**:

- `NOT_FOUND_VALID_VALUE`: 未传递title/bvid

---

## 错误代码表

| 错误码                  | HTTP状态码 | 描述                          |
|-------------------------|------------|-------------------------------|
| BOARD_NOT_EXISTS        | 404        | 请求的榜单不存在              |
| ISSUE_NOT_EXISTS        | 404        | 请求的期号不存在              |
| TARGET_NOT_EXISTS       | 400        | 缺少必需参数                  |
| TARGET_NOT_NUMBER       | 400        | 参数类型错误                  |
| NUMBER_OUT_OF_RANGE     | 400        | 数值超出允许范围              |
| PARAMETER_VALUE_ILLEGAL | 400        | 参数值不在允许范围内          |
| NOT_FOUND_VALID_VALUE   | 400        | 缺少有效搜索条件              |
| DISALLOW_MULTIPLE_TARGET| 400        | 禁止传递多个参数              |
| NO_ENTRY_EXISTS         | 404        | 请求的资源无数据              |
| NOT_IMPLEMENTED_YET     | 501        | 接口未实现                    |

---

**备注**:

1. 所有接口均支持GET/POST方法
2. 分页参数`index`从1开始计数
3. 时间参数格式为ISO 8601
4. 错误响应包含`code`和`message`字段说明具体错误
