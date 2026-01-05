import { TTS_ENGINE } from '../config';

let currentAudio: HTMLAudioElement | null = null;
let currentRequestId: number = 0;
let currentAudioContext: AudioContext | null = null;
let currentPCMPlayer: PCMStreamPlayer | null = null;

// PCM 音频参数（根据阿里云 Qwen-TTS 文档）
const PCM_SAMPLE_RATE = 24000; // 采样率
const PCM_CHANNELS = 1; // 单声道

/**
 * PCM 流式播放器类
 * 使用 Web Audio API 实现流式 PCM 音频播放
 */
class PCMStreamPlayer {
  private audioContext: AudioContext;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private onEndCallback: (() => void) | null = null;
  private pendingBuffers: number = 0;
  private streamEnded: boolean = false;
  private hasStarted: boolean = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.nextStartTime = 0;
  }

  /**
   * 将 Base64 编码的 PCM 数据添加到播放队列
   */
  addPCMChunk(base64Data: string): void {
    try {
      // Base64 解码
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 将 16-bit PCM 转换为 Float32（Web Audio API 需要）
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        // 16-bit 有符号整数范围是 -32768 到 32767，转换为 -1.0 到 1.0
        float32[i] = pcm16[i] / 32768.0;
      }

      // 创建 AudioBuffer
      const audioBuffer = this.audioContext.createBuffer(
        PCM_CHANNELS,
        float32.length,
        PCM_SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(float32);

      // 调度播放
      this.scheduleBuffer(audioBuffer);

      if (!this.hasStarted) {
        this.hasStarted = true;
        console.log('TTS: 开始流式播放音频');
      }
    } catch (e) {
      console.error('TTS: PCM 数据处理失败:', e);
    }
  }

  /**
   * 调度音频缓冲区播放
   */
  private scheduleBuffer(audioBuffer: AudioBuffer): void {
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // 计算开始时间，确保无缝播放
    const currentTime = this.audioContext.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.pendingBuffers++;

    // 更新下一个缓冲区的开始时间
    this.nextStartTime += audioBuffer.duration;

    source.onended = () => {
      this.pendingBuffers--;
      this.checkPlaybackEnd();
    };

    this.isPlaying = true;
  }

  /**
   * 标记流结束
   */
  markStreamEnd(): void {
    this.streamEnded = true;
    this.checkPlaybackEnd();
  }

  /**
   * 检查是否所有音频都播放完成
   */
  private checkPlaybackEnd(): void {
    if (this.streamEnded && this.pendingBuffers === 0 && this.isPlaying) {
      this.isPlaying = false;
      console.log('TTS: 流式音频播放完成');
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    }
  }

  /**
   * 设置播放结束回调
   */
  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  /**
   * 停止播放
   */
  stop(): void {
    this.isPlaying = false;
    this.streamEnded = true;
    this.pendingBuffers = 0;
  }
}

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
 * 使用阿里 Qwen-TTS 引擎朗读文本 (真正的流式播放)
 * 使用 Web Audio API 实时播放 PCM 音频数据
 */
async function speakWithQwen(text: string, voice: string | undefined, requestId: number): Promise<void> {
  try {
    console.log(`TTS: 正在通过 Qwen-TTS 合成语音 (流式模式)... (音色: ${voice || '默认'})`);

    return new Promise((resolve, reject) => {
      let processedLength = 0;
      let sseBuffer = ''; // 用于缓存跨 chunk 的不完整 SSE 数据
      let pcmPlayer: PCMStreamPlayer | null = null;
      let audioContext: AudioContext | null = null;
      let chunkCount = 0;

      const cleanup = () => {
        if (pcmPlayer) {
          pcmPlayer.stop();
          pcmPlayer = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close().catch(() => { });
        }
        currentAudioContext = null;
        currentPCMPlayer = null;
      };

      // 初始化 Web Audio API
      const initAudio = () => {
        if (!audioContext) {
          audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          currentAudioContext = audioContext;
          pcmPlayer = new PCMStreamPlayer(audioContext);
          currentPCMPlayer = pcmPlayer;

          pcmPlayer.onEnd(() => {
            cleanup();
            resolve();
          });
        }
        return pcmPlayer!;
      };

      // 解析 SSE 文本并处理 PCM 音频数据
      const parseSSEChunk = (newText: string) => {
        // 将新数据追加到缓冲区
        sseBuffer += newText;

        // 按换行符分割，处理完整的行
        const lines = sseBuffer.split('\n');

        // 保留最后一个可能不完整的行
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            console.log('TTS: 收到 [DONE] 信号');
            continue;
          }

          try {
            const json = JSON.parse(dataStr);

            // 处理流式 PCM 音频数据
            if (json.output?.audio?.data) {
              const player = initAudio();
              player.addPCMChunk(json.output.audio.data);
              chunkCount++;
              if (chunkCount % 5 === 0) {
                console.log(`TTS: 已处理 ${chunkCount} 个音频块`);
              }
            }

            if (json.code && json.message) {
              console.error('TTS: 服务端返回错误:', json.code, json.message);
            }
          } catch (e) {
            // JSON 解析失败，可能是不完整的数据，记录但不报错
            if (dataStr.length > 0 && dataStr !== ':') {
              console.warn('TTS: JSON 解析失败，数据长度:', dataStr.length);
            }
          }
        }
      };

      // 使用 XMLHttpRequest 处理流式响应
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/tts', true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onprogress = () => {
        if (requestId !== currentRequestId) {
          xhr.abort();
          cleanup();
          return;
        }

        // 获取新增的响应文本
        const responseText = xhr.responseText;
        const newText = responseText.substring(processedLength);
        processedLength = responseText.length;

        if (newText) {
          parseSSEChunk(newText);
        }
      };

      xhr.onload = () => {
        if (requestId !== currentRequestId) {
          cleanup();
          resolve();
          return;
        }

        console.log('TTS: XHR 请求完成，状态:', xhr.status, '总共处理:', chunkCount, '个音频块');

        if (xhr.status >= 200 && xhr.status < 300) {
          // 处理可能遗留的最后一部分数据
          const responseText = xhr.responseText;
          const newText = responseText.substring(processedLength);
          if (newText) {
            parseSSEChunk(newText);
          }

          // 处理缓冲区中可能剩余的数据
          if (sseBuffer.trim()) {
            parseSSEChunk('\n'); // 触发处理最后一行
          }

          // 标记流结束，等待播放完成
          if (pcmPlayer) {
            pcmPlayer.markStreamEnd();
          } else {
            // 没有收到任何音频数据，降级到 Web Speech API
            console.warn('TTS: 没有收到音频数据，降级到 Web Speech API');
            speakWithWeb(text, requestId).then(resolve).catch(reject);
          }
        } else {
          console.error('TTS: XHR 请求失败:', xhr.status, xhr.statusText, xhr.responseText);
          cleanup();
          // 降级到 Web Speech API
          speakWithWeb(text, requestId).then(resolve).catch(reject);
        }
      };

      xhr.onerror = () => {
        console.error('TTS: XHR 网络错误');
        cleanup();
        if (requestId === currentRequestId) {
          speakWithWeb(text, requestId).then(resolve).catch(reject);
        } else {
          resolve();
        }
      };

      xhr.ontimeout = () => {
        console.error('TTS: XHR 超时');
        cleanup();
        if (requestId === currentRequestId) {
          speakWithWeb(text, requestId).then(resolve).catch(reject);
        } else {
          resolve();
        }
      };

      xhr.timeout = 60000;
      xhr.send(JSON.stringify({ text, voice, stream: true }));
    });
  } catch (error) {
    if (requestId !== currentRequestId) return;
    console.error('Qwen-TTS 失败，尝试降级到 Web Speech API:', error);
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

  // 停止 PCM 流式播放
  if (currentPCMPlayer) {
    currentPCMPlayer.stop();
    currentPCMPlayer = null;
  }

  // 关闭 AudioContext
  if (currentAudioContext && currentAudioContext.state !== 'closed') {
    currentAudioContext.close().catch(() => { });
    currentAudioContext = null;
  }
}

