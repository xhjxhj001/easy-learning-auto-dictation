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
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';

// 配置跨域和 Body 解析（处理 base64 大图片）
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OCR Proxy Server is running' });
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

