# Vocacili API 服务文档

## 1. 接口基础信息
- **服务配置**：
  - 默认接口地址：`http://127.0.0.1:51001`
  - CORS策略：允许所有来源（`origin: *`），支持GET/POST方法

## 2. 接口列表

### 2.1 获取曲目信息
- **路径**：`/get_info/song`
- **方法**：GET
- **请求参数**：
  | 参数名 | 类型 | 必填 | 说明 | 约束 |
  |--------|------|------|------|------|
  | target | string[] | 是 | 曲目ID列表 | 最多200个 |
  
- **响应示例**：
  ```json
  {
    "metadata": {
      "id": "SONG_001",
      "name": "Example Song",
      "type": "vocaloid",
      "target": {
        "vocalist": [{"id":"V_01","name":"Hatsune Miku","color":"#00FF00"}],
        "producer": [{"id":"P_01","name":"ProducerX"}],
        "synthesizer": [{"id":"SV_01","name":"VOCALOID5"}]
      }
    },
    "platform": [{
      "link": "https://b23.tv/av123456",
      "publish": "2023-01-01",
      "duration": "03:45",
      "thumbnail": "https://i0.hdslb.com/bfs/archive/example.jpg"
    }]
  }
  ```

### 2.2 获取当前期数排行榜
- **路径**：`/get_info/board/_current`
- **方法**：GET
- **参数**：
  | 参数名 | 类型 | 说明 | 约束 |
  |--------|------|------|------|
  | board | string | 榜单ID（如vocaoid-weekly-main） | 必填 |
  | count | number | 每页数量 | 1-200，默认50 |
  | index | number | 页码 | 1-131072，默认1 |

- **响应新增字段**：
  ```json
  {
    "metadata": {
      "issue": 256,
      "date": "2023-12-25"
    },
    "board": [{
      "last": {  // 新增上期排名信息
        "rank": 5,
        "point": 9500
      }
    }]
  }
  ```

### 2.3 高级搜索接口
#### 2.3.1 按平台信息搜索
- **路径**：`/search/song_list/by_platform`
- **参数**：
  | 参数名 | 说明 | 示例 |
  |--------|------|------|
  | bvid | B站视频ID | BV1Ab411d7fg |
  | title | 视频标题关键词 | 初音未来 |

#### 2.3.2 按曲目名称搜索
- **路径**：`/search/song_list/by_song_name`
- **参数**：
  | 参数名 | 说明 | 示例 |
  |--------|------|------|
  | target | 曲目名称关键词 | 千本樱 |

### 2.4 历史数据接口
#### 2.4.1 统计量历史
- **路径**：`/get_history/song/count`
- **参数**：
  | 参数名 | 说明 | 特殊值 |
  |--------|------|------|
  | count | 获取数量 | -1表示获取全部 |

#### 2.4.2 排名历史
- **路径**：`/get_history/song/rank`
- **新增参数**：
  | 参数名 | 说明 |
  |--------|------|
  | board | 指定多个榜单ID |
  | issue | 指定多个期数 |

### 2.5 列表获取接口
- **路径**：`/get_list/:type`
- **支持类型**：
  ```javascript
  ["song", "board", "vocalist", "producer", "synthesizer"]
  ```
- **响应结构**：
  ```json
  {
    "data": [
      {"id": "BOARD_01", "name": "主榜", "issue": 256},  // 当type=board时
      {"id": "SONG_001", "name": "Example Song", ...}    // 当type=song时
    ]
  }
  ```

## 3. 数据结构定义

### 3.1 通用响应结构
```typescript
interface APIResponse<T> {
  code: "OK" | "BOARD_NOT_EXISTS" | "TARGET_NOT_EXISTS"; // 完整错误码见附录
  time: ISO8601;
  data: T;
  message?: string;
  extra?: {
    debug?: {
      timing: {
        consume: string; // 如 "5.4ms"
      }
    }
  }
}
```

### 3.2 排行榜元数据
```json
{
  "catalog": [{
    "issue": 256,
    "date": "2023-12-25",
    "count": 50
  }]
}
```

## 4. 配置项说明
`config.json` 关键配置：
```json
{
  "service": {
    "interface": {
      "port": 51001,
      "cors": {  // CORS配置
        "origin": "*",
        "methods": ["GET","POST"],
        "allowedHeaders": ["Content-Type"]
      }
    }
  },
  "database": {
    "default": {
      "filepath": "./assets/database/default.db",  // SQLite数据库路径
      "framework": "./source/define/db-fw.json"    // 表结构定义
    }
  }
}
```

## 附录：错误代码表
| 代码 | 说明 | 常见原因 |
|------|------|------|
| BOARD_NOT_EXISTS | 榜单不存在 | 错误的board参数 |
| ISSUE_NOT_EXISTS | 期数不存在 | 该期未发布或参数错误 |
| TARGET_NOT_EXISTS | 缺少必要参数 | 未传递target参数 |
| DISALLOW_MULTIPLE_TARGET | 多目标禁止 | 传入了数组型参数 |

更新说明：
1. 新增了搜索类接口文档
2. 补充了历史数据接口的分页参数说明
3. 明确了分页参数的最大值限制（index ≤ 131072）
4. 添加了调试信息字段说明
5. 更新了错误代码附录表