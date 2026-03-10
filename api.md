# 微信小程序 API 接口文档

## 1. 基础信息

### 1.1 接口基础路径
```
https://api.example.com/v1
```

### 1.2 响应格式
所有接口返回 JSON 格式数据，标准响应结构：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

## 2. 商品相关接口

### 2.1 获取首页轮播图
- **路径**: `/banners`
- **请求方式**: `GET`
- **请求参数**: 无
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 轮播图ID |
  | image | string | 轮播图图片URL |

### 2.2 获取推荐商品
- **路径**: `/goods/recommended`
- **请求方式**: `GET`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | page | number | 否 | 页码，默认1 |
  | limit | number | 否 | 每页数量，默认10 |
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 商品ID |
  | name | string | 商品名称 |
  | price | number | 商品价格 |
  | unit | string | 商品单位 |
  | specs | string | 商品规格 |
  | prices | object | 不同单位价格 |
  | image | string | 商品图片URL |

### 2.3 获取分类列表
- **路径**: `/categories`
- **请求方式**: `GET`
- **请求参数**: 无
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 分类ID |
  | name | string | 分类名称 |

### 2.4 获取分类商品
- **路径**: `/goods/category/:categoryId`
- **请求方式**: `GET`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | categoryId | number | 是 | 分类ID |
  | page | number | 否 | 页码，默认1 |
  | limit | number | 否 | 每页数量，默认10 |
- **返回字段**: 同推荐商品

### 2.5 获取商品详情
- **路径**: `/goods/:id`
- **请求方式**: `GET`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | id | number | 是 | 商品ID |
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 商品ID |
  | name | string | 商品名称 |
  | price | number | 商品价格 |
  | unit | string | 商品单位 |
  | prices | object | 不同单位价格 |
  | description | string | 商品描述 |
  | specs | string | 商品规格 |
  | tags | array | 商品标签 |
  | images | array | 商品图片列表 |
  | detailImages | array | 商品详情图片列表 |

### 2.6 搜索商品
- **路径**: `/goods/search`
- **请求方式**: `GET`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | keyword | string | 是 | 搜索关键词 |
  | page | number | 否 | 页码，默认1 |
  | limit | number | 否 | 每页数量，默认10 |
- **返回字段**: 同推荐商品

## 3. 购物车相关接口

### 3.1 获取购物车列表
- **路径**: `/cart`
- **请求方式**: `GET`
- **请求参数**: 无
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 商品ID |
  | name | string | 商品名称 |
  | price | number | 商品价格 |
  | unit | string | 商品单位 |
  | specs | string | 商品规格 |
  | image | string | 商品图片URL |
  | count | number | 商品数量 |
  | totalPrice | string | 商品总价 |

### 3.2 添加商品到购物车
- **路径**: `/cart`
- **请求方式**: `POST`
- **请求体**:
  ```json
  {
    "goodsId": 1,
    "count": 2,
    "unit": "斤"
  }
  ```
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | success | boolean | 是否成功 |
  | message | string | 操作消息 |

### 3.3 更新购物车商品
- **路径**: `/cart/:id`
- **请求方式**: `PUT`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | id | number | 是 | 商品ID |
- **请求体**:
  ```json
  {
    "count": 3,
    "unit": "件"
  }
  ```
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | success | boolean | 是否成功 |
  | message | string | 操作消息 |

### 3.4 删除购物车商品
- **路径**: `/cart/:id`
- **请求方式**: `DELETE`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | id | number | 是 | 商品ID |
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | success | boolean | 是否成功 |
  | message | string | 操作消息 |

## 4. 订单相关接口

### 4.1 创建订单
- **路径**: `/orders`
- **请求方式**: `POST`
- **请求体**:
  ```json
  {
    "items": [
      {
        "goodsId": 1,
        "count": 2,
        "price": 38.00,
        "unit": "斤"
      }
    ],
    "totalPrice": "76.00"
  }
  ```
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | orderId | number | 订单ID |
  | time | string | 订单时间 |
  | status | string | 订单状态 |

### 4.2 获取订单列表
- **路径**: `/orders`
- **请求方式**: `GET`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | status | string | 否 | 订单状态 |
  | page | number | 否 | 页码，默认1 |
  | limit | number | 否 | 每页数量，默认10 |
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 订单ID |
  | time | string | 订单时间 |
  | items | array | 订单商品列表 |
  | totalPrice | string | 订单总价 |
  | status | string | 订单状态 |

### 4.3 获取订单详情
- **路径**: `/orders/:id`
- **请求方式**: `GET`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | id | number | 是 | 订单ID |
- **返回字段**: 同订单列表项

### 4.4 取消订单
- **路径**: `/orders/:id/cancel`
- **请求方式**: `POST`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | id | number | 是 | 订单ID |
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | success | boolean | 是否成功 |
  | message | string | 操作消息 |

## 5. 用户相关接口

### 5.1 获取用户信息
- **路径**: `/user/info`
- **请求方式**: `GET`
- **请求参数**: 无
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 用户ID |
  | nickname | string | 用户昵称 |
  | avatar | string | 用户头像 |
  | phone | string | 用户手机号 |

### 5.2 获取订单统计
- **路径**: `/user/order-stats`
- **请求方式**: `GET`
- **请求参数**: 无
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | totalOrders | number | 总订单数 |
  | totalAmount | number | 总消费金额 |
  | pendingPayment | number | 待支付订单数 |
  | completedOrders | number | 已完成订单数 |

### 5.3 获取地址列表
- **路径**: `/user/addresses`
- **请求方式**: `GET`
- **请求参数**: 无
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | id | number | 地址ID |
  | name | string | 收货人姓名 |
  | phone | string | 收货人手机号 |
  | province | string | 省份 |
  | city | string | 城市 |
  | district | string | 区县 |
  | detail | string | 详细地址 |
  | isDefault | boolean | 是否默认地址 |

### 5.4 添加地址
- **路径**: `/user/addresses`
- **请求方式**: `POST`
- **请求体**:
  ```json
  {
    "name": "张三",
    "phone": "13800138000",
    "province": "北京市",
    "city": "北京市",
    "district": "朝阳区",
    "detail": "建国路88号",
    "isDefault": true
  }
  ```
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | success | boolean | 是否成功 |
  | message | string | 操作消息 |

## 6. 其他接口

### 6.1 分享商品
- **路径**: `/goods/:id/share`
- **请求方式**: `POST`
- **请求参数**:
  | 参数名 | 类型 | 必填 | 描述 |
  |-------|------|------|------|
  | id | number | 是 | 商品ID |
- **请求体**:
  ```json
  {
    "type": "friend" // friend 或 timeline
  }
  ```
- **返回字段**:
  | 字段名 | 类型 | 描述 |
  |-------|------|------|
  | success | boolean | 是否成功 |
  | message | string | 操作消息 |

## 7. 错误码说明

| 错误码 | 描述 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 501 | 接口未实现 |
