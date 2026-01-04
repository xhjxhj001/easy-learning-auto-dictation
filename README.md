# 听写学习应用

一个基于 React + TypeScript 的听写学习应用，支持拍照识别、OCR 文字识别、词语管理和自动朗读功能。

## 功能特性

1. **拍照识别**：支持拍照或上传图片进行 OCR 文字识别
2. **智能切词**：自动将识别结果切分成词语列表，按顺序排列
   - 智能合并因折行拆分的词语
   - 正确识别中英文混合文本
3. **词语管理**：
   - 默认选中第一个词语
   - 支持点击选择其他词语
   - 支持删除选中的词语
4. **听写功能**：
   - 从选中的词语开始按顺序朗读
   - 可设置朗读间隔时间（1-60秒）
   - 支持暂停/继续功能
   - 支持停止听写
5. **图片压缩**：
   - 自动压缩大图片，避免 OCR API 超限
   - 支持最大 10MB 图片上传

## 技术栈

- React 18
- TypeScript
- Vite 5
- Ant Design 5
- 百度 OCR API（OCR 识别）
- Axios（HTTP 请求）
- Web Speech API（文本转语音）

## 项目结构

```
learning-app-1/
├── src/
│   ├── components/
│   │   ├── CameraCapture.tsx    # 拍照/上传组件
│   │   └── WordList.tsx         # 词语列表组件
│   ├── config/
│   │   └── index.ts             # 应用配置
│   ├── utils/
│   │   ├── imageCompress.ts     # 图片压缩工具
│   │   ├── ocr.ts               # OCR 识别工具
│   │   ├── tts.ts               # 语音合成工具
│   │   └── wordSegment.ts       # 切词工具
│   ├── App.tsx                  # 主应用组件
│   ├── App.css                  # 应用样式
│   ├── main.tsx                 # 入口文件
│   └── index.css                # 全局样式
├── start.sh                     # 启动脚本
├── stop.sh                      # 停止脚本
├── restart.sh                   # 重启脚本
├── package.json
├── vite.config.ts
└── README.md
```

## 快速开始

### 1. 配置环境

在项目根目录创建 `.env` 文件：

```bash
# 百度OCR API密钥（必填）
# 请到 https://console.bce.baidu.com/ai/#/ai/ocr/overview/index 申请
VITE_BAIDU_OCR_API_KEY=你的百度OCR_API密钥

# 服务监听端口（可选，默认3000）
VITE_PORT=3000
```

### 2. 启动服务

```bash
# 赋予脚本执行权限（首次运行）
chmod +x start.sh stop.sh restart.sh

# 启动服务（后台运行）
./start.sh
```

启动脚本会自动：
- 校验配置文件
- 检测并安装/更新依赖
- 后台启动服务
- 输出访问地址和管理命令

### 3. 管理服务

```bash
# 查看日志
tail -f app.log

# 停止服务
./stop.sh

# 重启服务
./restart.sh

# 重启并强制更新依赖
./restart.sh -u
```

## 代码更新说明

| 文件类型 | 更新后是否自动生效 |
|---------|------------------|
| JS/TS/CSS 代码 | ✅ Vite HMR 自动热更新 |
| package.json | ⚠️ 需要 `./restart.sh -u` |
| vite.config.ts | ⚠️ 需要 `./restart.sh` |
| .env 配置 | ⚠️ 需要 `./restart.sh` |

## 手动运行（不使用脚本）

```bash
# 安装依赖
npm install

# 启动开发服务器（前台运行）
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 使用说明

1. **拍照识别**：
   - 点击「选择图片」按钮上传图片
   - 或点击「拍照」按钮使用相机拍照
   - 系统会自动压缩图片并进行 OCR 识别

2. **管理词语**：
   - 识别结果会显示在词语列表中
   - 点击词语可以选中
   - 点击「删除」可以移除不需要的词语

3. **开始听写**：
   - 设置朗读间隔时间（默认 3 秒）
   - 选择起始词语
   - 点击「开始听写」按钮
   - 支持暂停/继续/停止

## 配置说明

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|-------|------|-------|------|
| `VITE_BAIDU_OCR_API_KEY` | ✅ | - | 百度 OCR API 密钥 |
| `VITE_PORT` | ❌ | 3000 | 服务监听端口 |

### Vite 配置

- 监听地址：`0.0.0.0`（允许外部访问）
- 允许所有域名访问
- 依赖预构建优化
- 代码分割（React/Antd/Axios 分别打包）

## 运行时文件

以下文件在运行时自动生成，已添加到 `.gitignore`：

- `.app.pid` - 进程 PID 文件
- `.deps.hash` - 依赖 hash 文件（用于检测更新）
- `app.log` - 服务日志文件

## 注意事项

- 需要配置百度 OCR API 密钥才能使用 OCR 识别功能
- 语音合成功能需要浏览器支持 Web Speech API
- 建议使用 Chrome、Edge 等现代浏览器以获得最佳体验
- 百度 OCR API 需要网络连接，请确保网络畅通
- 图片大小限制：最大 10MB，超过 1MB 会自动压缩

## 常见问题

### Q: 上传图片没有反应？
A: 请检查浏览器控制台是否有错误信息，确认 API 密钥配置正确。

### Q: OCR 识别失败，提示 "input oversize"？
A: 图片过大，应用会自动压缩，如仍有问题请尝试使用更小的图片。

### Q: 域名访问被拒绝？
A: 已配置 `allowedHosts: true`，支持所有域名访问。如仍有问题请重启服务。

### Q: 端口号没有生效？
A: 确保使用 `./start.sh` 启动服务，环境变量会正确传递给 Vite。
