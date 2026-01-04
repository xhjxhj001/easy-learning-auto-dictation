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
 * 使用后端代理服务识别图片中的文字（包含重试机制）
 * @param imageFile 图片文件
 * @param retryCount 重试次数
 * @returns 识别出的文字
 */
export async function recognizeText(imageFile: File, retryCount = 2): Promise<string> {
  console.log(`OCR: 开始识别流程, 文件大小: ${imageFile.size}, 剩余重试次数: ${retryCount}`);
  
  const executeRequest = async (currentRetry: number): Promise<string> => {
    try {
      const imageBase64 = await fileToBase64(imageFile);
      
      // 请求我们自己的后端接口
      console.log('OCR: 正在发送请求到后端代理...');
      const response = await axios({
        method: 'POST',
        url: '/api/ocr', // 使用相对路径，Vite 会根据配置转发
        data: {
          image: imageBase64
        },
        timeout: 45000,
      });

      const data = response.data;
      
      if (data.error_code) {
        // ... (保持重试逻辑不变)
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
      // ... (保持重试逻辑不变)
      if (currentRetry > 0) {
        console.warn('OCR: 请求失败，正在进行重试...', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return executeRequest(currentRetry - 1);
      }
      
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.error_msg || error.message;
        throw new Error(`OCR识别请求失败: ${errorMsg}`);
      }
      throw error;
    }
  };

  return executeRequest(retryCount);
}

