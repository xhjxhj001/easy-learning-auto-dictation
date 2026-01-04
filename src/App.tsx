import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, InputNumber, Space, message, Spin, Tabs, Input, Tooltip, FloatButton } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  SettingOutlined, 
  CopyOutlined, 
  SoundOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  VerticalAlignTopOutlined
} from '@ant-design/icons';
import CameraCapture from './components/CameraCapture';
import WordList, { WordItem } from './components/WordList';
import { recognizeText } from './utils/ocr';
import { segmentWords } from './utils/wordSegment';
import { speakText, stopSpeaking } from './utils/tts';
import './App.css';

const { TextArea } = Input;

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [fullText, setFullText] = useState<string>('');
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(3);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('1');
  
  const speakingIndexRef = useRef<number>(-1);
  const timeoutRef = useRef<number | null>(null);

  // 诊断信息：检查配置是否加载成功
  useEffect(() => {
    const mountTime = performance.now();
    const startTime = (window as any).PAGELOAD_START || mountTime;
    console.log(`[Performance] 5. React 组件挂载完成, 总耗时: ${(mountTime - startTime).toFixed(2)}ms`);
    
    console.log('App: 听写应用已加载');
    // 检查环境变量
    const apiKey = import.meta.env.VITE_BAIDU_OCR_API_KEY;
    if (!apiKey || apiKey === '你的百度OCR_API密钥') {
      console.error('App: VITE_BAIDU_OCR_API_KEY 未配置或为默认值');
      message.error('配置错误：未检测到有效的 OCR API Key，请检查 .env 文件并重启服务', 0);
    } else {
      console.log('App: OCR API Key 已检测到 (长度: ' + apiKey.length + ')');
    }
  }, []);

  // 处理图片捕获
  const handleImageCapture = async (file: File) => {
    console.log('App: handleImageCapture 开始, 文件:', file.name, file.size);
    
    // 先重置状态
    setImageFile(file);
    setWords([]);
    setFullText('');
    setSelectedWordId(null);
    setIsProcessing(true);
    
    // 显示处理提示
    let hideLoading: (() => void) | null = null;
    
    try {
      hideLoading = message.loading('正在准备数据并上传...', 0);
      
      console.log('App: 开始OCR识别...');
      // OCR识别
      const text = await recognizeText(file);
      
      if (hideLoading) hideLoading();
      hideLoading = message.loading('数据已送达，正在分析结果...', 0);
      
      console.log('App: OCR识别结果:', text);
      
      if (!text || text.trim().length === 0) {
        message.warning('未识别到文字，请确保图片清晰且包含文字');
        return;
      }

      // 保存全文结果
      setFullText(text);
      
      // 切词处理
      console.log('App: 开始切词...');
      const wordTexts = segmentWords(text);
      console.log('App: 切词结果:', wordTexts);
      
      if (wordTexts.length > 0) {
        // 创建词语列表
        const wordItems: WordItem[] = wordTexts.map((text, index) => ({
          id: index,
          text,
          selected: index === 0, // 默认选中第一个
        }));
        
        setWords(wordItems);
        setSelectedWordId(0);
      }
      
      message.success(`识别成功`);
    } catch (error) {
      console.error('App: 图片处理错误:', error);
      const errorMessage = error instanceof Error ? error.message : '处理失败，请重试';
      message.error(errorMessage);
    } finally {
      // 确保 loading 消息被关闭
      if (hideLoading) {
        hideLoading();
      }
      console.log('App: handleImageCapture 完成, 重置 isProcessing');
      setIsProcessing(false);
    }
  };

  // 选择词语
  const handleSelectWord = (id: number) => {
    setWords(prevWords =>
      prevWords.map(word => ({
        ...word,
        selected: word.id === id,
      }))
    );
    setSelectedWordId(id);
  };

  // 删除词语
  const handleDeleteWord = (id: number) => {
    setWords(prevWords => {
      const newWords = prevWords.filter(word => word.id !== id);
      // 重新分配ID，保持连续
      const reindexedWords = newWords.map((word, index) => ({
        ...word,
        id: index,
        selected: index === 0 && newWords.length > 0,
      }));
      
      // 如果删除的是当前选中的，选中第一个
      if (id === selectedWordId) {
        setSelectedWordId(newWords.length > 0 ? 0 : null);
      }
      
      return reindexedWords;
    });
  };

  // 开始听写 (切词模式)
  const handleStartDictation = async () => {
    if (words.length === 0) {
      message.warning('请先拍照识别词语');
      return;
    }

    if (selectedWordId === null) {
      message.warning('请先选择一个词语');
      return;
    }

    // 如果正在朗读，先停止
    if (isSpeaking) {
      stopSpeaking();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsSpeaking(false);
      setIsPaused(false);
      return;
    }

    setIsSpeaking(true);
    setIsPaused(false);
    
    // 从选中的词语开始
    const startIndex = selectedWordId;
    speakingIndexRef.current = startIndex;

    // 开始朗读流程
    await speakWordsFromIndex(startIndex);
  };

  // 从指定索引开始朗读词语
  const speakWordsFromIndex = async (startIndex: number) => {
    if (isPaused) {
      return;
    }

    for (let i = startIndex; i < words.length; i++) {
      if (isPaused) {
        speakingIndexRef.current = i;
        break;
      }

      const word = words[i];
      speakingIndexRef.current = i;
      
      // 更新选中状态
      handleSelectWord(word.id);

      try {
        // 朗读当前词语
        await speakText(word.text);
        
        // 如果不是最后一个词语，等待指定时间间隔
        if (i < words.length - 1 && !isPaused) {
          await new Promise<void>((resolve) => {
            timeoutRef.current = window.setTimeout(() => {
              resolve();
            }, intervalSeconds * 1000);
          });
        }
      } catch (error) {
        console.error('朗读失败:', error);
        message.error('朗读失败');
        break;
      }
    }

    // 朗读完成
    if (!isPaused) {
      setIsSpeaking(false);
      speakingIndexRef.current = -1;
      message.success('听写完成');
    }
  };

  // 暂停/继续 (仅适用于切词听写模式)
  const handlePause = () => {
    if (isPaused) {
      // 继续
      setIsPaused(false);
      const currentIndex = speakingIndexRef.current;
      if (currentIndex >= 0 && currentIndex < words.length) {
        speakWordsFromIndex(currentIndex);
      }
    } else {
      // 暂停
      setIsPaused(true);
      stopSpeaking();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  // 朗读全文
  const handleSpeakFullText = async () => {
    if (!fullText.trim()) {
      message.warning('没有可朗读的内容');
      return;
    }

    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      await speakText(fullText);
    } catch (error) {
      message.error('朗读失败');
    } finally {
      setIsSpeaking(false);
    }
  };

  // 复制全文
  const handleCopyFullText = () => {
    if (!fullText.trim()) {
      message.warning('没有可复制的内容');
      return;
    }
    navigator.clipboard.writeText(fullText).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const commonCameraArea = (
    <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #f0f0f0' }}>
      <h3>1. 拍照/上传图片识别</h3>
      <Spin spinning={isProcessing}>
        <CameraCapture
          onImageCapture={handleImageCapture}
          disabled={isProcessing || isSpeaking}
        />
      </Spin>
    </div>
  );

  const items = [
    {
      key: '1',
      label: (
        <span>
          <FontSizeOutlined />
          切词听写
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {commonCameraArea}

          {/* 设置和控制 */}
          <div>
            <h3>2. 听写设置与控制</h3>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <span>朗读间隔（秒）：</span>
                <Space.Compact>
                  <Button disabled icon={<SettingOutlined />} style={{ backgroundColor: '#f5f5f5', color: '#666' }} />
                  <InputNumber
                    min={1}
                    max={60}
                    style={{ width: '80px' }}
                    value={intervalSeconds}
                    onChange={(value) => setIntervalSeconds(value || 3)}
                    disabled={isSpeaking}
                  />
                </Space.Compact>
              </Space>
              
              <div style={{ marginTop: '10px' }}>
                <Button
                  type="primary"
                  size="large"
                  icon={isSpeaking ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={handleStartDictation}
                  disabled={words.length === 0 || selectedWordId === null}
                  loading={isProcessing}
                  block
                >
                  {isSpeaking ? '停止听写' : '开始听写'}
                </Button>
                {isSpeaking && (
                  <Button
                    style={{ marginTop: '10px' }}
                    onClick={handlePause}
                    block
                  >
                    {isPaused ? '继续' : '暂停'}
                  </Button>
                )}
              </div>
            </Space>
          </div>

          {/* 词语列表 */}
          <div id="word-list-section">
            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              3. 词语列表（点击选择，可删除）
              {words.length > 10 && (
                <Button 
                  type="link" 
                  size="small" 
                  icon={<VerticalAlignTopOutlined />}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  回到顶部
                </Button>
              )}
            </h3>
            <WordList
              words={words}
              onSelectWord={handleSelectWord}
              onDeleteWord={handleDeleteWord}
            />
          </div>
          
          <FloatButton.BackTop visibilityHeight={400} />
        </Space>
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <FileTextOutlined />
          全文朗读
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {commonCameraArea}

          <div>
            <h3>2. OCR 全文结果（可编辑）</h3>
            <TextArea
              rows={10}
              value={fullText}
              onChange={(e) => setFullText(e.target.value)}
              placeholder="OCR 识别结果将显示在这里..."
              style={{ fontSize: '16px' }}
            />
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                size="large"
                icon={<SoundOutlined />}
                onClick={handleSpeakFullText}
                disabled={!fullText}
                loading={isProcessing}
                block
              >
                {isSpeaking ? '停止朗读' : '朗读全文'}
              </Button>
              <Tooltip title="一键复制全文">
                <Button 
                  icon={<CopyOutlined />} 
                  onClick={handleCopyFullText}
                  disabled={!fullText}
                  block
                >
                  一键复制
                </Button>
              </Tooltip>
            </Space>
          </div>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-container">
      <Card title="听写学习应用" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={(key) => {
            setActiveTab(key);
            stopSpeaking();
            setIsSpeaking(false);
            setIsPaused(false);
          }}
          items={items}
        />
      </Card>
    </div>
  );
};

export default App;
