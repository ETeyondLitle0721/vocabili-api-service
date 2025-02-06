# vocacili-api-service

这是一个主要由 NodeJS 开发的 Vocacili 项目的 API 服务源代码储存仓库。

本文档详细描述了后端提供的各个API接口及其字段含义。

## 1. 获取当前排行榜信息

**接口路径**: `/get_current_board_info`

**请求方法**: `GET`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `board` | `string` | 是 | 需要获取的排行榜名称。 |
| `count` | `number` | 否 | 要获取的排行榜条目数量，默认为50。 |
| `index` | `number` | 否 | 当前页数，默认为1。 |

**响应字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `board` | `Array<Object>` | 排行榜数据列表。 |
| `metadata` | `Object` | 排行榜的元数据信息。 |

**`board` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `rank` | `Object` | 曲目的排名信息。 |
| `count` | `number` | 曲目的统计量。 |
| `change` | `Object` | 曲目的排名变化信息。 |
| `target` | `Object` | 曲目的详细信息。 |

**`rank` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量排名。 |
| `like` | `number` | 点赞量排名。 |
| `coin` | `number` | 投币量排名。 |
| `board` | `number` | 综合排名。 |
| `favorite` | `number` | 收藏量排名。 |

**`change` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量变化。 |
| `like` | `number` | 点赞量变化。 |
| `coin` | `number` | 投币量变化。 |
| `favorite` | `number` | 收藏量变化。 |

**`target` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `metadata` | `Object` | 曲目的元数据信息。 |
| `platform` | `Object` | 曲目的平台信息。 |

**`metadata` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 曲目的唯一标识符。 |
| `name` | `string` | 曲目的名称。 |
| `type` | `string` | 曲目的类型。 |
| `target` | `Object` | 曲目的相关创作者信息。 |

**`target` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `vocalist` | `Array<Object>` | 曲目的歌手信息。 |
| `producer` | `Array<string>` | 曲目的制作人信息。 |
| `synthesizer` | `Array<string>` | 曲目的合成器信息。 |

**`platform` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `link` | `string` | 曲目的平台链接。 |
| `publish` | `string` | 曲目的发布时间。 |
| `page` | `string` | 曲目的页面信息。 |
| `title` | `string` | 曲目的标题。 |
| `uploader` | `Array<string>` | 曲目的上传者信息。 |
| `duration` | `string` | 曲目的时长。 |
| `thumbnail` | `string` | 曲目的缩略图链接。 |
| `copyright` | `string` | 曲目的版权信息。 |

**`metadata` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 排行榜的唯一标识符。 |
| `name` | `string` | 排行榜的名称。 |
| `issue` | `number` | 排行榜的期数。 |

---

## 2. 获取曲目信息

**接口路径**: `/get_song_info`

**请求方法**: `GET`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `target` | `Array<string>` | 是 | 需要获取信息的曲目ID列表。 |

**响应字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `metadata` | `Object` | 曲目的元数据信息。 |
| `platform` | `Array<Object>` | 曲目的平台信息。 |

**`metadata` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 曲目的唯一标识符。 |
| `name` | `string` | 曲目的名称。 |
| `type` | `string` | 曲目的类型。 |
| `target` | `Object` | 曲目的相关创作者信息。 |

**`target` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `vocalist` | `Array<Object>` | 曲目的歌手信息。 |
| `producer` | `Array<string>` | 曲目的制作人信息。 |
| `synthesizer` | `Array<string>` | 曲目的合成器信息。 |

**`platform` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `link` | `string` | 曲目的平台链接。 |
| `publish` | `string` | 曲目的发布时间。 |
| `page` | `string` | 曲目的页面信息。 |
| `title` | `string` | 曲目的标题。 |
| `uploader` | `Array<string>` | 曲目的上传者信息。 |
| `duration` | `string` | 曲目的时长。 |
| `thumbnail` | `string` | 曲目的缩略图链接。 |
| `copyright` | `string` | 曲目的版权信息。 |

---

## 3. 获取指定期数的排行榜信息

**接口路径**: `/get_board_info`

**请求方法**: `GET`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `board` | `string` | 是 | 需要获取的排行榜名称。 |
| `issue` | `number` | 是 | 需要获取的期数。 |
| `count` | `number` | 否 | 要获取的排行榜条目数量，默认为50。 |
| `index` | `number` | 否 | 当前页数，默认为1。 |

**响应字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `board` | `Array<Object>` | 排行榜数据列表。 |
| `metadata` | `Object` | 排行榜的元数据信息。 |

**`board` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `rank` | `Object` | 曲目的排名信息。 |
| `count` | `number` | 曲目的统计量。 |
| `change` | `Object` | 曲目的排名变化信息。 |
| `target` | `Object` | 曲目的详细信息。 |

**`rank` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量排名。 |
| `like` | `number` | 点赞量排名。 |
| `coin` | `number` | 投币量排名。 |
| `board` | `number` | 综合排名。 |
| `favorite` | `number` | 收藏量排名。 |

**`change` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量变化。 |
| `like` | `number` | 点赞量变化。 |
| `coin` | `number` | 投币量变化。 |
| `favorite` | `number` | 收藏量变化。 |

**`target` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `metadata` | `Object` | 曲目的元数据信息。 |
| `platform` | `Object` | 曲目的平台信息。 |

**`metadata` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 曲目的唯一标识符。 |
| `name` | `string` | 曲目的名称。 |
| `type` | `string` | 曲目的类型。 |
| `target` | `Object` | 曲目的相关创作者信息。 |

**`target` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `vocalist` | `Array<Object>` | 曲目的歌手信息。 |
| `producer` | `Array<string>` | 曲目的制作人信息。 |
| `synthesizer` | `Array<string>` | 曲目的合成器信息。 |

**`platform` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `link` | `string` | 曲目的平台链接。 |
| `publish` | `string` | 曲目的发布时间。 |
| `page` | `string` | 曲目的页面信息。 |
| `title` | `string` | 曲目的标题。 |
| `uploader` | `Array<string>` | 曲目的上传者信息。 |
| `duration` | `string` | 曲目的时长。 |
| `thumbnail` | `string` | 曲目的缩略图链接。 |
| `copyright` | `string` | 曲目的版权信息。 |

**`metadata` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 排行榜的唯一标识符。 |
| `name` | `string` | 排行榜的名称。 |
| `issue` | `number` | 排行榜的期数。 |

---

## 4. 获取曲目历史统计量信息

**接口路径**: `/get_song_count_history_info`

**请求方法**: `GET`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `target` | `string` | 是 | 需要获取历史统计量的曲目ID。 |
| `count` | `number` | 否 | 要获取的历史记录数量，默认为300。书写-1表示获取所有数据 |
| `index` | `number` | 否 | 当前页数，默认为1。 |

**响应字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `date` | `string` | 统计量的日期。 |
| `count` | `Object` | 曲目的统计量信息。 |

**`count` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量。 |
| `like` | `number` | 点赞量。 |
| `coin` | `number` | 投币量。 |
| `favorite` | `number` | 收藏量。 |

---

## 5. 获取曲目历史排名信息

**接口路径**: `/get_song_rank_history_info`

**请求方法**: `GET`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `target` | `string` | 是 | 需要获取历史排名的曲目ID。 |
| `issue` | `Array<number>` | 否 | 需要获取的期数列表。 |
| `board` | `Array<string>` | 否 | 需要获取的排行榜列表。 |
| `count` | `number` | 否 | 要获取的历史记录数量，默认为50。 |
| `index` | `number` | 否 | 当前页数，默认为1。 |

**响应字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `rank` | `Object` | 曲目的排名信息。 |
| `target` | `string` | 曲目的ID。 |
| `point` | `number` | 曲目的得分。 |
| `change` | `Object` | 曲目的排名变化信息。 |
| `issue` | `number` | 曲目的期数。 |
| `board` | `string` | 曲目的排行榜名称。 |

**`rank` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量排名。 |
| `like` | `number` | 点赞量排名。 |
| `coin` | `number` | 投币量排名。 |
| `favorite` | `number` | 收藏量排名。 |

**`change` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `view` | `number` | 观看量变化。 |
| `like` | `number` | 点赞量变化。 |
| `coin` | `number` | 投币量变化。 |
| `favorite` | `number` | 收藏量变化。 |

---

## 6. 获取排行榜元数据信息

**接口路径**: `/get_board_metadata_info`

**请求方法**: `GET`

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `target` | `string` | 是 | 需要获取元数据的排行榜名称。 |
| `set-cache` | `number` | 否 | 设置缓存时间，默认为0，单位秒。 |

**响应字段**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | `string` | 排行榜的唯一标识符。 |
| `name` | `string` | 排行榜的名称。 |
| `catalog` | `Array<Object>` | 排行榜的期数列表。 |

**`catalog` 字段结构**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `date` | `string` | 排行榜的出榜日期。 |
| `issue` | `number` | 排行榜的期数。 |
| `count` | `number` | 排行榜的上榜曲目总数量。 |

---
