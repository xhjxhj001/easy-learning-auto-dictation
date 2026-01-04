import axios from 'axios';
import { BAIDU_OCR_API_KEY, BAIDU_OCR_API_URL } from '../config';

/**
 * 将图片文件转换为base64字符串
 * @param file 图片文件
 * @returns base64字符串（不包含data:image前缀）
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除data:image/png;base64,前缀，只保留base64数据
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 使用百度OCR API识别图片中的文字
 * @param imageFile 图片文件
 * @returns 识别出的文字
 */
export async function recognizeText(imageFile: File): Promise<string> {
  try {
    // 检查API密钥
    if (!BAIDU_OCR_API_KEY) {
      throw new Error('请配置百度OCR API密钥。请在项目根目录创建.env文件，添加 VITE_BAIDU_OCR_API_KEY=你的密钥');
    }

    // 将图片转换为base64
    const imageBase64 = await fileToBase64(imageFile);

    // 准备请求数据（需要URL编码）
    const params = new URLSearchParams();
    params.append('image', imageBase64);
    params.append('detect_direction', 'false');
    params.append('detect_language', 'false');
    params.append('paragraph', 'false');
    params.append('probability', 'false');

    // 发送请求
    const response = await axios({
      method: 'POST',
      url: BAIDU_OCR_API_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Bearer ${BAIDU_OCR_API_KEY}`,
      },
      data: params.toString(),
    });

    // 解析响应
    const data = response.data;
    
    if (data.error_code) {
      throw new Error(`OCR识别失败: ${data.error_msg || '未知错误'}`);
    }

    // 提取文字结果
    // 百度OCR返回格式: { words_result: [{ words: "文字1" }, { words: "文字2" }], words_result_num: 2 }
    if (data.words_result && Array.isArray(data.words_result)) {
      const texts = data.words_result.map((item: { words: string }) => item.words);
      return texts.join('\n').trim();
    }

    return '';
  } catch (error) {
    console.error('OCR识别失败:', error);
    if (axios.isAxiosError(error)) {
      throw new Error(`OCR识别失败: ${error.response?.data?.error_msg || error.message}`);
    }
    throw error instanceof Error ? error : new Error('OCR识别失败，请重试');
  }
}

