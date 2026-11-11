# epub.js 迁移清单

扫描日期：2026-11-11。基于本地 epub.js `0.3.93`，提交 `eee359d0790002115a1156a9833c54f4bcd44c1d`；扫描范围为 `src/`、`types/`、`examples/` 和 `test/`。按功能重写，不要求沿用原模块结构或所有历史 API。

## 进度维护

- 状态：未开始 → 进行中 → 待验证 → 已完成；无法推进时标为阻塞，并注明原因。
- 每次实现或验证 feature 后更新对应行；“实现 / 测试”列填写相对路径或 PR 链接。
- 已完成表示功能及对应测试通过；布局、滚动、选区相关功能还需真实浏览器验证。
- 当前工程基础已完成：TypeScript、Vite、pnpm、Oxlint、Prettier、测试及 CI。功能进度以本表为准，工程冒烟测试不计作功能完成。
- 兼容项保留在清单中，实施前确定支持范围；决定不支持时标为“范围外”并说明原因。

**功能进度：已完成 1 / 36；进行中 0；待验证 0；阻塞 0；未开始 35。** 状态变化时同步更新此统计；范围外条目单列，不计入完成数量。

## 第一阶段：打开书籍与定位基础

上游参考：[Book](../epub.js/src/book.js)、[Archive](../epub.js/src/archive.js)、[Packaging](../epub.js/src/packaging.js)、[CFI](../epub.js/src/epubcfi.js)。

| ID  | Feature / 实现范围                                                                         | 状态   | 实现 / 测试                                                |
| --- | ------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------- |
| F01 | 输入与请求：EPUB URL、ArrayBuffer、Base64、解压目录、OPF；自定义请求、headers、credentials | 已完成 | [输入与请求](../src/input/) / [测试](../tests/unit/input/) |
| F02 | ZIP 归档：解压、条目读取、文本 / Blob / Base64 输出、资源 URL 创建与回收                   | 未开始 | —                                                          |
| F03 | Container：解析 `META-INF/container.xml` 并定位 OPF                                        | 未开始 | —                                                          |
| F04 | Package：EPUB 2/3 元数据、manifest、spine、封面及布局属性解析                              | 未开始 | —                                                          |
| F05 | Spine / Section：阅读顺序、linear 属性、章节查询、前后章、加载、序列化与卸载               | 未开始 | —                                                          |
| F06 | 封面：EPUB 2/3 封面定位、封面 URL 和无封面处理                                             | 未开始 | —                                                          |
| F07 | 资源解析与替换：相对路径、编码、canonical、图片 / 字体、CSS `url()` / `@import`、Blob URL  | 未开始 | —                                                          |
| F08 | 导航：EPUB 3 nav、EPUB 2 NCX、嵌套目录、landmarks 与 href / ID 查询                        | 未开始 | —                                                          |
| F09 | 无渲染读取：独立使用元数据、目录、章节内容和资源，不创建阅读视图                           | 未开始 | —                                                          |
| F10 | CFI 基础：解析、序列化、比较、章节定位、点 / 范围 CFI 与范围折叠                           | 未开始 | —                                                          |
| F11 | CFI 与 DOM：Node / Range 双向转换、文本偏移、忽略标注包装节点                              | 未开始 | —                                                          |

## 第二阶段：基础阅读闭环

上游参考：[Rendition](../epub.js/src/rendition.js)、[Layout](../epub.js/src/layout.js)、[Contents](../epub.js/src/contents.js)、[默认视图管理器](../epub.js/src/managers/default/index.js)。F12 开始至少依赖第一阶段的加载与资源链路，CFI 跳转及定位依赖 F10–F11。

| ID  | Feature / 实现范围                                                             | 状态   | 实现 / 测试 |
| --- | ------------------------------------------------------------------------------ | ------ | ----------- |
| F12 | 基础渲染：挂载容器、iframe 章节视图、内容加载、显示 / 隐藏、默认禁用书内脚本   | 未开始 | —           |
| F13 | 重排分页：CSS 分栏、单页 / 双页、页间距、spread 阈值与模式切换                 | 未开始 | —           |
| F14 | 滚动阅读：`scrolled-doc` / `scrolled-continuous` 流模式及横纵轴处理            | 未开始 | —           |
| F15 | 阅读跳转：章节 / href / 锚点 / CFI / 百分比定位、上一页 / 下一页与跨章跳转     | 未开始 | —           |
| F16 | 可视位置：可见内容到 CFI 映射、起止位置、当前页信息、首尾边界与 relocated 通知 | 未开始 | —           |
| F17 | 动态重排：容器尺寸、方向、图片 / 字体 / 媒体查询变化后重算布局并保留阅读位置   | 未开始 | —           |
| F18 | 固定布局：pre-paginated、viewport 缩放、左右页及固定布局跨页显示               | 未开始 | —           |
| F19 | 阅读方向：LTR / RTL、竖排 writing-mode、滚动轴及翻页方向适配                   | 未开始 | —           |

## 第三阶段：阅读增强

上游参考：[Locations](../epub.js/src/locations.js)、[PageList](../epub.js/src/pagelist.js)、[连续视图管理器](../epub.js/src/managers/continuous/index.js)、[主题](../epub.js/src/themes.js)、[标注](../epub.js/src/annotations.js)。本阶段建立在基础阅读与 CFI 定位之上。

| ID  | Feature / 实现范围                                                                    | 状态   | 实现 / 测试 |
| --- | ------------------------------------------------------------------------------------- | ------ | ----------- |
| F20 | 阅读进度：按字符 / 单词生成位置、CFI / 位置 / 百分比换算、当前位置及位置表保存 / 恢复 | 未开始 | —           |
| F21 | 纸书页码：nav page-list / NCX pageList、页码 / CFI / 百分比换算                       | 未开始 | —           |
| F22 | 连续视图：跨章无缝滚动 / 分页、相邻章节预加载、视图裁剪及滚动位置补偿                 | 未开始 | —           |
| F23 | 触控：滑动翻页、滚动吸附及移动端交互                                                  | 未开始 | —           |
| F24 | 主题与排版：CSS / URL / 规则注册、主题切换、字体 / 字号及样式覆盖                     | 未开始 | —           |
| F25 | 内容交互：选区 / Range / CFI 通知、键鼠与触控事件转发、书内链接与外链处理             | 未开始 | —           |
| F26 | 标注：highlight / underline / mark、增删改、点击事件、章节重载后恢复及重排后定位      | 未开始 | —           |
| F27 | 文本搜索：章节内及跨文本节点匹配，返回摘要与 CFI，供调用方聚合全书结果                | 未开始 | —           |
| F28 | 事件：类型化 on / off / once，书籍、渲染、位置、选区及错误事件                        | 未开始 | —           |
| F29 | 扩展机制：异步内容 / 序列化 / 渲染 / 卸载钩子、自定义 manager / view 与样式注入       | 未开始 | —           |

## 第四阶段：兼容项与稳定性

上游参考：[Store](../epub.js/src/store.js)、[DisplayOptions](../epub.js/src/displayoptions.js)、[InlineView](../epub.js/src/managers/views/inline.js)、[扩展示例](../epub.js/examples/)。F35–F36 是贯穿前面各阶段的要求，不应留到最后补做。

| ID  | Feature / 实现范围                                                                               | 状态   | 实现 / 测试 |
| --- | ------------------------------------------------------------------------------------------------ | ------ | ----------- |
| F30 | 离线缓存：资源持久化、在线 / 离线切换、离线读取与资源 URL 回收                                   | 未开始 | —           |
| F31 | JSON manifest 兼容：metadata、readingOrder / spine、resources、toc 输入                          | 未开始 | —           |
| F32 | Apple 显示选项兼容：fixed-layout、open-to-spread、orientation-lock、interactive 的解析与适用行为 | 未开始 | —           |
| F33 | Inline view 兼容：评估非 iframe 渲染的支持范围及内容隔离边界                                     | 未开始 | —           |
| F34 | 脚本兼容：显式授权的书内脚本 / 弹窗、脚本注入及 `navigator.epubReadingSystem` 能力声明           | 未开始 | —           |
| F35 | 生命周期与错误：加载状态、错误传播、任务排队、并发 / 取消、幂等销毁、监听器 / 观察器 / URL 清理  | 未开始 | —           |
| F36 | 不可信输入防护（重写增强）：路径越界、畸形 XML、归档大小限制、远程资源策略与脚本隔离边界         | 未开始 | —           |

## 验收与问题跟踪

- 各 feature 完成时补齐正常、边界、错误路径与回归测试；核心 EPUB 2/3 夹具及 RTL、竖排、固定布局场景按对应功能建立。
- 参考上游 `test/` 与 `examples/` 的行为重新验证，不将示例存在、类型声明存在或历史测试通过视为功能正确的证明。
- 本次清单来自本地代码扫描，未盘点上游 issue。后续 issue 记录放到 `docs/issues/`，关联本表的 F 编号；feature 完成不等于其相关 issue 已全部解决。
- 阅读器工具栏、书架、书签 / 笔记持久化、Hypothesis 等第三方服务集成不作为库内置 feature；由调用方或扩展实现。
