const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();
// 优先读取显式的后端端口，否则使用前端端口+1
const PORT = process.env.SERVER_PORT || (parseInt(process.env.VITE_PORT || 3000) + 1);
const BAIDU_API_KEY = process.env.VITE_BAIDU_OCR_API_KEY;
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';
const QWEN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

// 配置跨域和 Body 解析（处理 base64 大图片）
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy Server is running' });
});

// Qwen-TTS 代理接口
app.post('/api/tts', async (req, res) => {
  console.log('[Server] 收到 TTS 请求');
  const { text, voice = 'Cherry', stream = false } = req.body;

  if (!text) {
    return res.status(400).json({ error: '文本不能为空' });
  }

  if (!DASHSCOPE_API_KEY) {
    console.error('[Server] 未配置 DASHSCOPE_API_KEY');
    return res.status(500).json({ error: '服务器未配置 DashScope API Key' });
  }

  try {
    console.log('[Server] 正在请求 Qwen-TTS API, 模式:', stream ? '流式' : '非流式', '文本长度:', text.length);

    const requestData = {
      model: 'qwen3-tts-flash-2025-11-27',
      input: {
        text: text,
        voice: voice,
        language_type: 'Chinese'
      },
      parameters: {
        audio_format: 'mp3'
      }
    };

    if (stream) {
      // 流式模式配置
      console.log('[Server] 发起阿里云流式请求...');
      const response = await axios({
        method: 'POST',
        url: QWEN_TTS_URL,
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'enable'
        },
        data: requestData,
        responseType: 'stream'
      });

      console.log('[Server] 阿里云响应状态:', response.status);

      // 设置响应头为 SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 将阿里返回的流直接转发给前端
      response.data.pipe(res);

      response.data.on('end', () => {
        console.log('[Server] Qwen-TTS 流式响应正常结束');
      });

      response.data.on('error', (err) => {
        console.error('[Server] Qwen-TTS 流读取发生错误:', err);
        if (!res.headersSent) {
          res.status(500).end();
        }
      });

    } else {
      // 非流式模式逻辑保持不变
      const response = await axios({
        method: 'POST',
        url: QWEN_TTS_URL,
        headers: {
          'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-SSE': 'disable'
        },
        data: requestData,
        timeout: 60000,
      });

      if (response.data && response.data.output && response.data.output.audio && response.data.output.audio.url) {
        console.log('[Server] Qwen-TTS 响应成功, URL:', response.data.output.audio.url);
        res.json({ audio_url: response.data.output.audio.url });
      } else {
        console.error('[Server] Qwen-TTS 返回异常:', JSON.stringify(response.data));
        res.status(500).json({ error: '语音合成失败', details: response.data });
      }
    }
  } catch (error) {
    const errorDetail = error.response ? error.response.data : error.message;
    console.error('[Server] Qwen-TTS 请求失败:', JSON.stringify(errorDetail));
    const status = error.response ? error.response.status : 500;
    if (!res.headersSent) {
      res.status(status).json({
        error: '语音合成服务异常',
        message: error.message,
        details: errorDetail
      });
    }
  }
});

// OCR 代理接口
app.post('/api/ocr', async (req, res) => {
  console.log('[Server] 收到 OCR 请求');
  
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error_code: 400, error_msg: '图片数据不能为空' });
  }

  if (!BAIDU_API_KEY) {
    console.error('[Server] 未配置 VITE_BAIDU_OCR_API_KEY');
    return res.status(500).json({ error_code: 500, error_msg: '服务器未配置 API Key' });
  }

  try {
    const params = new URLSearchParams();
    params.append('image', image);
    params.append('detect_direction', 'false');
    params.append('detect_language', 'false');
    params.append('paragraph', 'false');
    params.append('probability', 'false');

    console.log('[Server] 正在请求百度 API...');
    const response = await axios({
      method: 'POST',
      url: BAIDU_OCR_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Bearer ${BAIDU_API_KEY}`,
      },
      data: params.toString(),
      timeout: 30000,
    });

    console.log('[Server] 百度 API 响应成功');
    res.json(response.data);
  } catch (error) {
    console.error('[Server] OCR 转发失败:', error.message);
    const status = error.response ? error.response.status : 500;
    const errorData = error.response ? error.response.data : { error_msg: error.message };
    res.status(status).json(errorData);
  }
});

// 启动服务
app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`  OCR 后端代理服务已启动`);
  console.log(`  监听地址: http://0.0.0.0:${PORT}`);
  console.log(`========================================`);
});

