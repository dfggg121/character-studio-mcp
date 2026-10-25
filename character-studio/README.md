# Character Studio MCP / 角色工作室

通用 MCP 服务：收集有来源的角色材料，编译人格与视觉资料，准备 Q 版绘图任务，并用隔离场景评估角色回答。当前版本 **0.6.0**，仍为研究原型。

## 安装

需要 Node.js >=22。图片解码依赖锁定版本的 sharp；发布包不包含 node_modules。

```sh
npm ci
npm test
npm start
```

通用客户端示例（改成实际绝对路径）：

```json
{"mcpServers":{"character_studio":{"command":"node","args":["/absolute/path/character-studio/src/server.mjs"],"env":{"CHARACTER_STUDIO_ROOT":"/absolute/path/character-data","CHARACTER_STUDIO_NETWORK":"true","CHARACTER_STUDIO_REQUIRE_SESSION":"true"}}}}
```

Windows DeepSeek Harness：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-dsh.ps1 -EnableNetwork
```

需要插件直接调用 DeepSeek 做评审、回答或训练迭代时，附加 `-ModelEnvFile '已有本地.env文件的绝对路径'`。文件中配置 `DEEPSEEK_API_KEY`；不要提交文件或在聊天中发送密钥。安装脚本只保存文件路径，Node 启动时载入。未配置模型时仍能规划、抓取、审计和导出，不会自动执行付费调用。Brave 搜索可选配置 `BRAVE_SEARCH_API_KEY`，或让宿主记录其搜索结果。

安装器向已有 desktop profile 添加 MCP 配置，备份原配置，按源码哈希触发更新；没有热加载时重启 Harness。使用 `-Uninstall` 移除本插件注册。已验证 Harness 0.2.1-rc.3 内置 MCP SDK 2.2.0 的 legacy 协议协商，不宣称实现新版 MCP 协议。

## 工作流程

1. `start_research` 固定角色、作品、世界线、时间阶段、外观变体和预算。
2. 先补身份、角色知道的事及事件因果，再补语言、行动、动机和反例。所有搜索先预留额度；抓取保留来源、哈希、精确片段与上下文。
3. 区分原作、梦境、分支、宣传与推断。官方宣传页中的原作片段可单独登记，不能因此把整页提升为原作证据。独立语义评审与结构审计都通过后才编译可部署画像。
4. 图片使用 PNG/JPEG/WebP 真正解码。先选择目标主体、外观阶段和可见区域，再提取外观。Harness 原生图片入库失败时，可显式执行 `review_reference_image`，通过配置的 DeepSeek 视觉通道观察；视觉输出不自动证明角色身份。
5. `create_training_run` 冻结材料与 train/dev/test 题目；检查计划后显式 `run_training(execute:true)`。按调用上限训练、开发集选版，最后封存测试。合格修订才允许激活，支持回滚。
6. 实际对话可调用 `generate_role_reply`：每次新上下文，明确场景与状态，检查道具、能力和依据。生成结果不直接执行桌面动作。

预算只约束插件内登记的调用，不能约束宿主绕过插件自行搜索。语义评审可能误判，结构检查也不能证明自由文本没有幻觉。

## 训练到底做了什么

当前内置的是**提示策略迭代与角色评估**，不修改模型权重。三个通用候选策略分别为基线、依据约束、依据加有证据的语言风格；每次演员调用只接收场景和角色卡，不接收评分答案。缺资料时应继续采集，不能靠循环编造生平。

`export_finetune_dataset` 只导出人工声明已批准且有原作依据的 TRAIN 示例，开发集和测试集不进入导出。它供外部训练服务使用；本插件尚未接入 LoRA/SFT 权重训练器。[训练流程与限制](docs/training-flow.md)。

## 工具

当前提供 34 个工具，分为研究计划/预算、来源抓取与评审、人格编译、图片观察与视觉审计、训练计划/运行/导出/激活/回滚、隔离角色回答、角色包交付。完整接口以 MCP `tools/list` 为准。

绘图执行仍依赖宿主绘图工具；本插件提供绑定人格的绘图任务和验收规则。尚未实现视频转录、完整桌宠动画生成或 Harness 桌宠资产适配。

## 实测状态

- 正式测试 144 通过，1 项 Windows 目录链接测试跳过。
- Harness 内置 SDK 的 34 工具发现、预算拒绝、抓取与图片块传递通过；独立 headless 的七步研究/训练计划流程通过。
- Harness 原生图片持久化失败；备用 DeepSeek 视觉通道已实际识别多人、发色不符与遮挡。
- 三次真实训练流程共 32 次模型调用，另外进行了 2 次语义回归和 1 次备用视觉调用。没有修改模型权重，没有达到可部署画像，也没有证明稳定的角色还原度提升。不同评估版本的分数不能直接比较。
- 前一轮三角色采集与 24 条回答的历史结论仍保留，不能用本轮接口测试代替三角色重测。

公开包仅提供 [汇总验证状态](docs/validation-summary.md)，不包含本地原始报告、日志或对话记录。

`reports/`、`artifacts/`、`.character-studio/`、`.env*`、`node_modules/` 不纳入发布包。网页快照与调用证据保留在本机用于追溯，不代表模型记忆；模型预训练中已知角色的影响仍需独立对照评估。
