/**
 * 应用配置
 */

// 百度OCR API配置
// 从环境变量读取，如果没有则使用空字符串（需要在运行时设置）
export const BAIDU_OCR_API_KEY = import.meta.env.VITE_BAIDU_OCR_API_KEY || '';

// 语音合成引擎配置
export const TTS_ENGINE = import.meta.env.VITE_TTS_ENGINE || 'web';

// 百度OCR API地址
export const BAIDU_OCR_API_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';

