import { TTS_ENGINE } from '../config';

let currentAudio: HTMLAudioElement | null = null;
let currentRequestId: number = 0;
let currentAudioContext: AudioContext | null = null;
let currentPCMPlayer: PCMStreamPlayer | null = null;
let currentXHR: XMLHttpRequest | null = null;

// PCM 音频参数（根据阿里云 Qwen-TTS 文档）
const PCM_SAMPLE_RATE = 24000; // 采样率
const PCM_CHANNELS = 1; // 单声道

// TTS 服务单次请求最大字节数（阿里云限制 600 字节）
const MAX_TEXT_BYTES = 580; // 留一点余量

/**
 * 计算字符串的 UTF-8 字节长度
 */
function getByteLength(str: string): number {
  return new Blob([str]).size;
}

/**
 * 将长文本分割成多个片段，每个片段不超过最大字节数
 * 智能分割：优先在句子结束处分割，其次在其他标点处分割
 * 支持中英文混合文本
 */
function splitTextForTTS(text: string, maxBytes: number = MAX_TEXT_BYTES): string[] {
  if (getByteLength(text) <= maxBytes) {
    return [text];
  }

  const segments: string[] = [];
  let remaining = text;

  // 主要分隔符（句子结束）- 中英文
  const primaryDelimiters = /([。！？.!?]+)/;
  // 次要分隔符（句内停顿）- 中英文
  const secondaryDelimiters = /([，；：、,;:]+)/;

  while (remaining.length > 0) {
    if (getByteLength(remaining) <= maxBytes) {
      segments.push(remaining);
      break;
    }

    // 估算字符数上限（中文约3字节，英文1字节，取中间值2）
    const estimatedCharLimit = Math.floor(maxBytes / 2);
    let endIndex = Math.min(remaining.length, estimatedCharLimit);

    // 调整 endIndex 确保字节数不超过限制
    while (endIndex > 0 && getByteLength(remaining.substring(0, endIndex)) > maxBytes) {
      endIndex--;
    }

    const chunk = remaining.substring(0, endIndex);
    let splitIndex = -1;

    // 优先在主要分隔符处分割（从后往前找）
    const primaryMatches = [...chunk.matchAll(new RegExp(primaryDelimiters, 'g'))];
    if (primaryMatches.length > 0) {
      const lastMatch = primaryMatches[primaryMatches.length - 1];
      splitIndex = lastMatch.index! + lastMatch[0].length;
    }

    // 如果没找到主要分隔符，或分割点太靠前，尝试次要分隔符
    const minSplitRatio = 0.3;
    if (splitIndex === -1 || splitIndex < endIndex * minSplitRatio) {
      const secondaryMatches = [...chunk.matchAll(new RegExp(secondaryDelimiters, 'g'))];
      if (secondaryMatches.length > 0) {
        const lastMatch = secondaryMatches[secondaryMatches.length - 1];
        const secondarySplitIndex = lastMatch.index! + lastMatch[0].length;
        if (secondarySplitIndex > splitIndex) {
          splitIndex = secondarySplitIndex;
        }
      }
    }

    // 如果还是没找到合适的分割点，尝试在空格处分割（英文）
    if (splitIndex === -1 || splitIndex < endIndex * minSplitRatio) {
      const spaceIndex = chunk.lastIndexOf(' ');
      if (spaceIndex > endIndex * minSplitRatio) {
        splitIndex = spaceIndex + 1;
      }
    }

    // 最后的兜底：强制分割
    if (splitIndex === -1 || splitIndex < endIndex * minSplitRatio) {
      splitIndex = endIndex;
    }

    const segment = remaining.substring(0, splitIndex).trim();
    if (segment.length > 0) {
      segments.push(segment);
    }
    remaining = remaining.substring(splitIndex).trim();
  }

  return segments.filter(s => s.length > 0);
}

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
 * 支持长文本自动分段，多次请求无缝播放
 */
async function speakWithQwen(text: string, voice: string | undefined, requestId: number): Promise<void> {
  try {
    // 分割长文本
    const segments = splitTextForTTS(text);
    const totalSegments = segments.length;

    if (totalSegments > 1) {
      console.log(`TTS: 文本过长 (${text.length} 字符)，已分割为 ${totalSegments} 段`);
    }
    console.log(`TTS: 正在通过 Qwen-TTS 合成语音 (流式模式)... (音色: ${voice || '默认'})`);

    return new Promise((resolve, reject) => {
      let pcmPlayer: PCMStreamPlayer | null = null;
      let audioContext: AudioContext | null = null;
      let totalChunkCount = 0;

      const cleanup = () => {
        currentXHR = null;
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

      // 初始化 Web Audio API（只初始化一次，多段共享）
      const initAudio = () => {
        if (!audioContext) {
          audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          currentAudioContext = audioContext;
          pcmPlayer = new PCMStreamPlayer(audioContext);
          currentPCMPlayer = pcmPlayer;

          pcmPlayer.onEnd(() => {
            console.log(`TTS: 所有音频播放完成，共 ${totalSegments} 段，${totalChunkCount} 个音频块`);
            cleanup();
            resolve();
          });
        }
        return pcmPlayer!;
      };

      // 处理单个文本段的 TTS 请求
      const processSegment = (segmentText: string, segmentIndex: number) => {
        return new Promise<void>((segmentResolve, segmentReject) => {
          if (requestId !== currentRequestId) {
            segmentResolve();
            return;
          }

          let processedLength = 0;
          let sseBuffer = '';
          let segmentChunkCount = 0;

          // 解析 SSE 文本并处理 PCM 音频数据
          const parseSSEChunk = (newText: string) => {
            sseBuffer += newText;
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;

              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const json = JSON.parse(dataStr);

                if (json.output?.audio?.data) {
                  const player = initAudio();
                  player.addPCMChunk(json.output.audio.data);
                  segmentChunkCount++;
                  totalChunkCount++;
                }

                if (json.code && json.message) {
                  console.error('TTS: 服务端返回错误:', json.code, json.message);
                }
              } catch (e) {
                // 忽略解析失败
              }
            }
          };

          const xhr = new XMLHttpRequest();
          currentXHR = xhr;
          xhr.open('POST', '/api/tts', true);
          xhr.setRequestHeader('Content-Type', 'application/json');

          xhr.onprogress = () => {
            if (requestId !== currentRequestId) {
              xhr.abort();
              return;
            }

            const responseText = xhr.responseText;
            const newText = responseText.substring(processedLength);
            processedLength = responseText.length;

            if (newText) {
              parseSSEChunk(newText);
            }
          };

          xhr.onload = () => {
            currentXHR = null;

            if (requestId !== currentRequestId) {
              segmentResolve();
              return;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
              // 处理剩余数据
              const responseText = xhr.responseText;
              const newText = responseText.substring(processedLength);
              if (newText) {
                parseSSEChunk(newText);
              }
              if (sseBuffer.trim()) {
                parseSSEChunk('\n');
              }

              console.log(`TTS: 第 ${segmentIndex + 1}/${totalSegments} 段完成，${segmentChunkCount} 个音频块`);
              segmentResolve();
            } else {
              console.error('TTS: XHR 请求失败:', xhr.status);
              segmentReject(new Error(`TTS request failed: ${xhr.status}`));
            }
          };

          xhr.onerror = () => {
            currentXHR = null;
            console.error('TTS: XHR 网络错误');
            segmentReject(new Error('Network error'));
          };

          xhr.ontimeout = () => {
            currentXHR = null;
            console.error('TTS: XHR 超时');
            segmentReject(new Error('Timeout'));
          };

          xhr.timeout = 60000;
          xhr.send(JSON.stringify({ text: segmentText, voice, stream: true }));
        });
      };

      // 顺序处理所有文本段
      const processAllSegments = async () => {
        try {
          for (let i = 0; i < segments.length; i++) {
            if (requestId !== currentRequestId) {
              cleanup();
              resolve();
              return;
            }

            await processSegment(segments[i], i);
          }

          // 所有段处理完成，标记流结束
          if (pcmPlayer) {
            pcmPlayer.markStreamEnd();
          } else {
            // 没有收到任何音频数据，降级到 Web Speech API
            console.warn('TTS: 没有收到音频数据，降级到 Web Speech API');
            speakWithWeb(text, requestId).then(resolve).catch(reject);
          }
        } catch (error) {
          console.error('TTS: 处理分段时出错:', error);
          cleanup();
          // 降级到 Web Speech API
          if (requestId === currentRequestId) {
            speakWithWeb(text, requestId).then(resolve).catch(reject);
          } else {
            resolve();
          }
        }
      };

      processAllSegments();
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

  // 中断正在进行的 XHR 请求
  if (currentXHR) {
    currentXHR.abort();
    currentXHR = null;
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

