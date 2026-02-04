# AI 标题降级器 — Mini Spec

## 目标
粘贴夸张标题/营销文案，AI 把它还原成平实的真实描述。如"这个产品改变了我的人生" → "这个产品还行"。

## 核心功能
- 输入框：粘贴夸张标题或营销文案
- 降级强度选择：温和 / 普通 / 暴力
- AI 降级：返回平实版本 + 夸张程度评分
- 对比展示：原文 vs 降级后
- 批量模式：一次粘贴多条标题
- i18n：7 种语言

## 技术方案
- 前端：React + Vite (TypeScript) + react-i18next
- 后端：Python FastAPI
- AI：llm-proxy.densematrix.ai
- 部署：Docker → langsheng
- 域名：title-downgrader.demo.densematrix.ai
