# DELF B2 词汇卡

这是一个可离线使用的手机友好型法语词汇卡应用，专为 DELF B2 备考设计。

## 使用

本地预览地址：

- Mac 上打开：`http://127.0.0.1:4173`
- 手机和 Mac 连接同一 Wi-Fi 后打开：`http://192.168.31.242:4173`

在手机浏览器中打开后，可以使用“添加到主屏幕”。添加后会像一个小应用一样启动，并缓存核心文件用于离线复习。

## 功能

- 分类查询：按主题筛选，也可以全文搜索法语、中文和例句。
- 高频标签：支持“高频”“写作”“口语”等考试场景标签。
- 例句记忆：每个词条包含 3 个法语例句和中文翻译。
- 词条详情：点击词条可查看词性、名词阴阳性、中法双语解释、近义词和反义词；近义词和反义词各不少于 5 个。
- 动词变位：动词和动词短语会显示直陈式、虚拟式、条件式、命令式、不定式和分词的常用变位项目。
- 随机测试：支持“法语 -> 中文”和“中文 -> 法语”双向默写。
- 学习记录：本地保存已掌握词条、测试次数和正确率。
- 词库导入：可以导入同样结构的 JSON 词库继续扩展。
- 在线增强：可通过后端代理连接法语助手 MCP，读取账号语料库中已有词条的释义和上下文；返回内容会缓存在本机，离线时继续可用。
- 法语助手生词本：在“词库”页手动同步账号生词本，生成独立分类 `法语助手生词本`，并加入随机测试；同步结果缓存在本机。

## 法语助手 API 接入

不要把 API key 写进 `app.js`、`index.html` 或任何会部署到 GitHub Pages 的前端文件。前端已经固定调用 `/api/lookup?word=...`，真正的 key 应放在后端环境变量里。

仓库中提供了 `api/lookup.js` 和 `api/eudic.js` 作为 Vercel/Serverless 代理模板。部署代理时设置这些环境变量：

- `FRDIC_API_KEY`：你的 API key，格式为 `NIS {token}`。
- `FRDIC_API_URL`：可选，默认 `https://api.frdic.com/fr/mcp`。
- `FRDIC_API_LANGUAGE`：可选，默认 `fr`。
- `FRDIC_API_KEY_HEADER`：API 要求的 key 请求头名称，默认 `Authorization`。
- `FRDIC_API_KEY_PREFIX`：可选。若 `FRDIC_API_KEY` 已经包含 `NIS `，这里不用设置。
- `ALLOWED_ORIGIN`：允许访问代理的前端域名，例如 `https://asiantiger08.github.io`。

截图中的 MCP 地址 `https://api.frdic.com/{language}/mcp` 已接入代理。当前使用的 MCP 工具是 `get_user_vocab_by_words`，它查询的是法语助手账号语料库/已收录词条，不是公共词典全库。因此如果某个词没有被账号语料库收录，在线增强会提示“法语助手账号语料库中没有这个词条”，本地词库仍会正常显示。

`/api/eudic?action=sync` 会调用法语助手 MCP 的生词本接口，读取账号里的生词分类和词条，前端统一放入 `法语助手生词本` 分类。该分类的信息以法语助手返回值为准；未返回的近义词、反义词、联想词、例句或变位会显示“法语助手未返回”，不会用主题词自动填充。

如果仍然只使用 GitHub Pages，网页会保留离线词库功能，但在线增强会提示“尚未部署 API 代理”。要启用在线增强，需要把代理部署到支持 Serverless 的平台，或把整站迁移到 Vercel/Netlify。

## 分类标准

词库按 DELF B2 常见论述主题分为 8 类：

1. `Le monde du travail`
2. `L'environnement`
3. `La technologie`
4. `L'éducation`
5. `La santé`
6. `Les médias et l'information`
7. `La société et les inégalités`
8. `La mondialisation`

## 当前词库

当前词库包含 3000+ 个 DELF B2 高频词、搭配和表达，覆盖上述 8 个主题。其中：

- `data/vocab.js`：精写核心词条，每条有更具体的例句。
- `data/vocab-3000.js`：主题扩展包，把词库扩展到至少 3000 条，并保证每条都有 3 个例句。

目标仍可继续扩展到 4000 个高频、常考词条。

每个词条格式如下：

```js
{
  fr: "remettre en question",
  zh: "质疑，重新考虑",
  category: "观点与论证",
  tags: ["高频", "写作"],
  examples: [
    { fr: "Cette réforme remet en question nos habitudes.", zh: "这项改革质疑了我们的习惯。" },
    { fr: "Les jeunes remettent souvent en question les traditions.", zh: "年轻人常常质疑传统。" },
    { fr: "Il est sain de remettre en question ses certitudes.", zh: "重新审视自己的确信是健康的。" }
  ]
}
```

继续扩展时，只要向 `window.B2_VOCAB = [...]` 数组中追加同样结构的词条即可。
