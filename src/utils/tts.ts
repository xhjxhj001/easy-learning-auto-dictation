import axios from 'axios';
import { TTS_ENGINE } from '../config';

let currentAudio: HTMLAudioElement | null = null;
let currentRequestId: number = 0;

/**
 * 朗读文本（支持多种引擎切换）
 * @param text 要朗读的文本
 * @param voice 音色 (仅 Qwen 引擎有效)
 * @returns Promise，朗读完成后resolve
 */
export async function speakText(text: string, voice?: string): Promise<void> {
  // 每次开始新的朗读前，先停止之前的
  stopSpeaking();
  const requestId = currentRequestId;

  if (TTS_ENGINE === 'qwen') {
    return speakWithQwen(text, voice, requestId);
  } else {
    return speakWithWeb(text, requestId);
  }
}

/**
 * 使用Web Speech API朗读文本
 */
function speakWithWeb(text: string, requestId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('浏览器不支持语音合成功能'));
      return;
    }

    if (requestId !== currentRequestId) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; // 中文
    utterance.rate = 1; // 语速
    utterance.pitch = 1; // 音调
    utterance.volume = 1; // 音量

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (error) => {
      // 如果是手动取消导致的错误，不作为异常处理
      if (requestId !== currentRequestId) {
        resolve();
      } else {
        reject(error);
      }
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * 使用阿里 Qwen-TTS 引擎朗读文本
 */
async function speakWithQwen(text: string, voice: string | undefined, requestId: number): Promise<void> {
  try {
    console.log(`TTS: 正在通过 Qwen-TTS 合成语音... (音色: ${voice || '默认'})`);
    const response = await axios.post('/api/tts', { text, voice });
    
    // 检查请求返回后是否已经被取消（点击了停止或开始了新的朗读）
    if (requestId !== currentRequestId) {
      console.log('TTS: 请求返回，但已被取消，不播放音频');
      return;
    }

    if (response.data && response.data.audio_url) {
      return new Promise((resolve, reject) => {
        const audio = new Audio(response.data.audio_url);
        currentAudio = audio;
        
        audio.onended = () => {
          currentAudio = null;
          resolve();
        };
        
        audio.onerror = () => {
          currentAudio = null;
          // 如果是由于取消导致的错误，不报错
          if (requestId !== currentRequestId) {
            resolve();
          } else {
            reject(new Error('音频播放失败'));
          }
        };
        
        audio.play().catch(err => {
          if (requestId !== currentRequestId) {
            resolve();
          } else {
            reject(err);
          }
        });
      });
    } else {
      throw new Error('获取语音地址失败');
    }
  } catch (error) {
    if (requestId !== currentRequestId) {
      return;
    }
    console.error('Qwen-TTS 失败，尝试降级到 Web Speech API:', error);
    // 降级处理
    return speakWithWeb(text, requestId);
  }
}

/**
 * 停止当前朗读
 */
export function stopSpeaking(): void {
  // 增加 ID 以使之前所有未完成的异步逻辑失效
  currentRequestId++;
  
  // 停止 Web Speech
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  
  // 停止 Audio 对象播放
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

