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
 * 使用百度OCR API识别图片中的文字（包含重试机制）
 * @param imageFile 图片文件
 * @param retryCount 重试次数
 * @returns 识别出的文字
 */
export async function recognizeText(imageFile: File, retryCount = 2): Promise<string> {
  console.log(`OCR: 开始识别流程, 文件大小: ${imageFile.size}, 剩余重试次数: ${retryCount}`);
  
  const executeRequest = async (currentRetry: number): Promise<string> => {
    try {
      // 检查API密钥
      if (!BAIDU_OCR_API_KEY) {
        throw new Error('未配置百度OCR API密钥');
      }

      const imageBase64 = await fileToBase64(imageFile);
      const params = new URLSearchParams();
      params.append('image', imageBase64);
      params.append('detect_direction', 'false');
      params.append('detect_language', 'false');
      params.append('paragraph', 'false');
      params.append('probability', 'false');

      const response = await axios({
        method: 'POST',
        url: BAIDU_OCR_API_URL,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Bearer ${BAIDU_OCR_API_KEY}`,
        },
        data: params.toString(),
        timeout: 45000, // 增加到 45 秒，给慢速网络更多时间
      });

      const data = response.data;
      
      if (data.error_code) {
        // 如果是临时性的网络或并发错误，尝试重试
        // 常见百度并发错误码: 1, 2, 4, 18
        const retryableCodes = [1, 2, 4, 18];
        if (retryableCodes.includes(data.error_code) && currentRetry > 0) {
          console.warn(`OCR: 收到可重试错误码 ${data.error_code}, 准备重试...`);
          return executeRequest(currentRetry - 1);
        }
        throw new Error(`OCR识别失败: ${data.error_msg} (错误码: ${data.error_code})`);
      }

      if (data.words_result && Array.isArray(data.words_result)) {
        return data.words_result.map((item: { words: string }) => item.words).join('\n').trim();
      }
      return '';
    } catch (error) {
      // 网络超时或连接异常，且还有重试机会
      if (currentRetry > 0) {
        console.warn('OCR: 网络请求失败，正在进行重试...', error);
        // 延迟 1 秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
        return executeRequest(currentRetry - 1);
      }
      
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new Error('网络请求超时，请检查网络连接或尝试上传更小的图片');
      }
      throw error;
    }
  };

  return executeRequest(retryCount);
}

